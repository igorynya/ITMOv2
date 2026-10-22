package generator

import (
	"context"
	"errors"
	"testing"
	"time"

	"vkusvill-collections/internal/domain"
	"vkusvill-collections/internal/testutil"
)

func TestGenerateBuildsAllCollections(t *testing.T) {
	fake := testutil.NewFakeMCP(nil)
	gen := New(fake, Options{Now: func() time.Time {
		return time.Unix(1700000000, 0).UTC()
	}})

	collections, err := gen.Generate(context.Background())
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if len(collections) != len(Templates()) {
		t.Fatalf("got %d collections, want %d", len(collections), len(Templates()))
	}

	seen := map[string]bool{}
	for _, col := range collections {
		if seen[col.ID] {
			t.Fatalf("duplicate collection id %q", col.ID)
		}
		seen[col.ID] = true
		if col.Generation != 1700000000 {
			t.Errorf("%s generation = %d", col.Slug, col.Generation)
		}
		if len(col.Items) < 3 {
			t.Errorf("%s has %d items", col.Slug, len(col.Items))
		}
		if col.Budget > 0 && col.Total > col.Budget {
			t.Errorf("%s total %d exceeds budget %d", col.Slug, col.Total, col.Budget)
		}
		if col.Total != productsTotal(col.Items) {
			t.Errorf("%s total %d != sum %d", col.Slug, col.Total, productsTotal(col.Items))
		}
		if col.Title == "" || col.Subtitle == "" {
			t.Errorf("%s has empty title or subtitle", col.Slug)
		}
	}
}

func TestGenerateSkipsFailedTemplate(t *testing.T) {
	fake := testutil.NewFakeMCP(nil)
	fake.Errors = map[string]error{"лосось": errors.New("upstream timeout")}
	gen := New(fake, Options{})

	collections, err := gen.Generate(context.Background())
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if len(collections) != len(Templates())-1 {
		t.Fatalf("got %d collections, want %d", len(collections), len(Templates())-1)
	}
	for _, col := range collections {
		if col.Slug == "romantic-dinner" {
			t.Fatal("failed template was not skipped")
		}
	}
}

func TestGenerateFailsWhenTooFewCollections(t *testing.T) {
	fake := testutil.NewFakeMCP(nil)
	fake.Err = errors.New("MCP unavailable")
	gen := New(fake, Options{})

	if _, err := gen.Generate(context.Background()); err == nil {
		t.Fatal("expected error")
	}
}

func TestGenerateCachesRepeatedQueries(t *testing.T) {
	fake := testutil.NewFakeMCP(nil)
	gen := New(fake, Options{})

	if _, err := gen.Generate(context.Background()); err != nil {
		t.Fatalf("Generate: %v", err)
	}

	unique := map[string]bool{}
	for _, tmpl := range Templates() {
		for _, item := range tmpl.Items {
			unique[item.Query] = true
		}
	}
	if fake.Searches != len(unique) {
		t.Fatalf("searches = %d, want %d unique queries", fake.Searches, len(unique))
	}
}

func TestPickCandidateFiltersByRatingAndUsage(t *testing.T) {
	products := []domain.Product{
		{ID: 1, Rating: 4.1},
		{ID: 2, Rating: 4.9},
		{ID: 3, Rating: 4.8},
	}

	got, ok := pickCandidate(products, 4.5, map[int]bool{2: true})
	if !ok {
		t.Fatal("expected candidate")
	}
	if got.ID != 3 {
		t.Fatalf("got product %d, want 3", got.ID)
	}

	if _, ok := pickCandidate(products, 5, nil); ok {
		t.Fatal("expected no candidate above rating 5")
	}
}

func TestFitBudgetRemovesOptionalItems(t *testing.T) {
	items := []candidate{
		{Product: domain.Product{ID: 1, Price: 200, Quantity: 1}},
		{Product: domain.Product{ID: 2, Price: 150, Quantity: 1}},
		{Product: domain.Product{ID: 3, Price: 100, Quantity: 1}},
		{Product: domain.Product{ID: 4, Price: 100, Quantity: 1}, Optional: true},
	}

	products, ok := fitBudget(items, 500)
	if !ok {
		t.Fatal("expected budget fit")
	}
	if len(products) != 3 {
		t.Fatalf("got %d products, want 3", len(products))
	}
	if total := productsTotal(products); total != 450 {
		t.Fatalf("total = %d, want 450", total)
	}
}

func TestFitBudgetFailsWhenMinimumIsTooExpensive(t *testing.T) {
	items := []candidate{
		{Product: domain.Product{ID: 1, Price: 300, Quantity: 1}},
		{Product: domain.Product{ID: 2, Price: 300, Quantity: 1}},
		{Product: domain.Product{ID: 3, Price: 300, Quantity: 1}},
	}

	if _, ok := fitBudget(items, 500); ok {
		t.Fatal("expected budget fit to fail")
	}
}
