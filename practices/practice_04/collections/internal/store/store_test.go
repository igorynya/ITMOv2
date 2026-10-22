package store

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"vkusvill-collections/internal/domain"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(context.Background()); err != nil {
		t.Fatal(err)
	}
	return s
}

func testCollections(generation int64, count int) []domain.Collection {
	cols := make([]domain.Collection, 0, count)
	for i := 0; i < count; i++ {
		cols = append(cols, domain.Collection{
			ID:         fmt.Sprintf("c-%d-%d", generation, i),
			Slug:       fmt.Sprintf("slug-%d", i),
			Title:      fmt.Sprintf("Подборка %d", i),
			Subtitle:   "Описание",
			Template:   "template",
			Budget:     500,
			Total:      450,
			Items:      []domain.Product{{ID: 1, Name: "Товар", Price: 150, Unit: "шт", Rating: 4.8, Quantity: 1}},
			Tags:       []string{"ужин"},
			Generation: generation,
			Active:     true,
			CreatedAt:  time.Now().UTC(),
		})
	}
	return cols
}

func TestSampleActiveReturnsOnlyLatestGeneration(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()

	if err := s.SaveGeneration(ctx, 1, testCollections(1, 5)); err != nil {
		t.Fatal(err)
	}
	if err := s.SaveGeneration(ctx, 2, testCollections(2, 4)); err != nil {
		t.Fatal(err)
	}

	got, err := s.SampleActive(ctx, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 4 {
		t.Fatalf("got %d collections, want 4", len(got))
	}
	for _, col := range got {
		if col.Generation != 2 || !col.Active {
			t.Fatalf("stale collection: %+v", col)
		}
		if len(col.Items) != 1 || col.Items[0].Name != "Товар" {
			t.Fatalf("items not decoded: %+v", col.Items)
		}
	}

	old, err := s.Get(ctx, testCollections(1, 5)[0].ID)
	if err != nil {
		t.Fatalf("old collection must stay readable: %v", err)
	}
	if old.Active {
		t.Fatal("old collection must be inactive")
	}
}

func TestCleanupKeepsFavoritedCollections(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()

	if err := s.SaveGeneration(ctx, 1, testCollections(1, 2)); err != nil {
		t.Fatal(err)
	}
	keep := testCollections(1, 2)[0].ID
	drop := testCollections(1, 2)[1].ID
	if err := s.AddFavorite(ctx, "visitor", keep); err != nil {
		t.Fatal(err)
	}
	if err := s.SaveGeneration(ctx, 2, testCollections(2, 1)); err != nil {
		t.Fatal(err)
	}
	if err := s.Cleanup(ctx, time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}

	if _, err := s.Get(ctx, keep); err != nil {
		t.Fatalf("favorited collection removed: %v", err)
	}
	if _, err := s.Get(ctx, drop); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unfavorited stale collection still exists: %v", err)
	}
}

func TestFavoritesPersistAndRemove(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	if err := s.SaveGeneration(ctx, 1, testCollections(1, 1)); err != nil {
		t.Fatal(err)
	}
	id := testCollections(1, 1)[0].ID

	if err := s.AddFavorite(ctx, "visitor", id); err != nil {
		t.Fatal(err)
	}
	if err := s.AddFavorite(ctx, "visitor", id); err != nil {
		t.Fatalf("duplicate favorite must be ignored: %v", err)
	}
	favs, err := s.ListFavorites(ctx, "visitor")
	if err != nil {
		t.Fatal(err)
	}
	if len(favs) != 1 {
		t.Fatalf("got %d favorites, want 1", len(favs))
	}

	if err := s.RemoveFavorite(ctx, "visitor", id); err != nil {
		t.Fatal(err)
	}
	favs, err = s.ListFavorites(ctx, "visitor")
	if err != nil {
		t.Fatal(err)
	}
	if len(favs) != 0 {
		t.Fatalf("favorites not removed: %d", len(favs))
	}
}

func TestAddFavoriteUnknownCollection(t *testing.T) {
	s := newTestStore(t)
	if err := s.AddFavorite(context.Background(), "visitor", "missing"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("got %v, want ErrNotFound", err)
	}
}

func TestCartURLCache(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	cols := testCollections(1, 1)
	if err := s.SaveGeneration(ctx, 1, cols); err != nil {
		t.Fatal(err)
	}

	at := time.Now().UTC().Truncate(time.Second)
	if err := s.SetCartURL(ctx, cols[0].ID, "https://example.test/cart", at); err != nil {
		t.Fatal(err)
	}
	got, err := s.Get(ctx, cols[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.CartURL != "https://example.test/cart" {
		t.Fatalf("CartURL = %q", got.CartURL)
	}
	if !got.CartSetAt.Equal(at) {
		t.Fatalf("CartSetAt = %v, want %v", got.CartSetAt, at)
	}

	if err := s.SetCartURL(ctx, "missing", "https://example.test", at); !errors.Is(err, ErrNotFound) {
		t.Fatalf("got %v, want ErrNotFound", err)
	}
}

func TestGenerationMetaAndReady(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()

	ready, err := s.HasActive(ctx)
	if err != nil || ready {
		t.Fatalf("empty store ready=%v err=%v", ready, err)
	}
	generation, err := s.LastGeneration(ctx)
	if err != nil || generation != 0 {
		t.Fatalf("generation=%d err=%v", generation, err)
	}

	if err := s.SaveGeneration(ctx, 42, testCollections(42, 1)); err != nil {
		t.Fatal(err)
	}
	ready, err = s.HasActive(ctx)
	if err != nil || !ready {
		t.Fatalf("ready=%v err=%v", ready, err)
	}
	generation, err = s.LastGeneration(ctx)
	if err != nil || generation != 42 {
		t.Fatalf("generation=%d err=%v", generation, err)
	}
}

func TestGetMissing(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.Get(context.Background(), "missing"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("got %v, want ErrNotFound", err)
	}
}
