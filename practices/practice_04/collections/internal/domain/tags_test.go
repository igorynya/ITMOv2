package domain

import (
	"strings"
	"testing"
)

func TestTrimTag(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{name: "plain", in: "ужин", want: "ужин"},
		{name: "spaces", in: "  ужин  ", want: "ужин"},
		{name: "tabs and newlines", in: "\tужин\n", want: "ужин"},
		{name: "nbsp", in: "\u00a0ужин\u00a0", want: "ужин"},
		{name: "inner spaces", in: "  ужин на двоих  ", want: "ужин на двоих"},
		{name: "empty", in: "", want: ""},
		{name: "only spaces", in: " \t\n ", want: ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := TrimTag(tc.in); got != tc.want {
				t.Fatalf("TrimTag(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestAvailableTagsTrimsSortsAndDedupes(t *testing.T) {
	cols := []Collection{
		{Tags: []string{" ужин ", "завтрак", ""}},
		{Tags: []string{"ужин", "перекус", "   "}},
	}

	got := AvailableTags(cols)
	want := []string{"завтрак", "перекус", "ужин"}
	if len(got) != len(want) {
		t.Fatalf("AvailableTags() = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("AvailableTags() = %v, want %v", got, want)
		}
	}
}

func TestAvailableTagsPicksCanonicalCaseVariant(t *testing.T) {
	got := AvailableTags([]Collection{{Tags: []string{"ужин", "Ужин"}}})
	if len(got) != 1 || got[0] != "Ужин" {
		t.Fatalf("AvailableTags() = %v, want [Ужин]", got)
	}
}

func TestAvailableTagsSkipsEmptyAndTooLong(t *testing.T) {
	short := strings.Repeat("я", 64)
	long := strings.Repeat("я", 65)
	cols := []Collection{{Tags: []string{"", "   ", short, long}}}

	got := AvailableTags(cols)
	if len(got) != 1 || got[0] != short {
		t.Fatalf("AvailableTags() = %v, want [%q]", got, short)
	}
}

func TestAvailableTagsEmptyInput(t *testing.T) {
	got := AvailableTags(nil)
	if got == nil {
		t.Fatal("AvailableTags(nil) returned nil, want empty slice")
	}
	if len(got) != 0 {
		t.Fatalf("AvailableTags(nil) = %v, want empty", got)
	}
}

func TestAvailableTagsKeepsInnerWhitespaceSignificant(t *testing.T) {
	got := AvailableTags([]Collection{{Tags: []string{"ужин на двоих", "ужин"}}})
	want := []string{"ужин", "ужин на двоих"}
	if len(got) != len(want) {
		t.Fatalf("AvailableTags() = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("AvailableTags() = %v, want %v", got, want)
		}
	}

	resolved, ok := ResolveTag(got, "ужин")
	if !ok || resolved != "ужин" {
		t.Fatalf("ResolveTag(ужин) = %q, %v, want ужин, true", resolved, ok)
	}
}

func TestAvailableTagsAllowsNULAndControlCharacters(t *testing.T) {
	tags := []string{"a\x00b\x01c", "\x00", "\x01\x1f"}
	want := []string{"\x00", "\x01\x1f", "a\x00b\x01c"}
	got := AvailableTags([]Collection{{Tags: tags}})
	if len(got) != len(want) {
		t.Fatalf("AvailableTags() = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("AvailableTags() = %v, want %v", got, want)
		}
	}
}

func TestResolveTagCaseInsensitive(t *testing.T) {
	available := []string{"завтрак", "ужин"}

	got, ok := ResolveTag(available, "УЖИН")
	if !ok || got != "ужин" {
		t.Fatalf("ResolveTag(УЖИН) = %q, %v, want ужин, true", got, ok)
	}

	got, ok = ResolveTag(available, "обед")
	if ok || got != "" {
		t.Fatalf("ResolveTag(обед) = %q, %v, want empty, false", got, ok)
	}
}

func TestHasTagMatchesAnyTag(t *testing.T) {
	col := Collection{Tags: []string{"завтрак", "ужин"}}
	if !HasTag(col, "ужин") {
		t.Fatal("HasTag() = false, want true")
	}
	if HasTag(col, "обед") {
		t.Fatal("HasTag() = true for missing tag")
	}
	if HasTag(Collection{}, "ужин") {
		t.Fatal("HasTag() = true for empty tags")
	}
}

func TestHasTagTrimsDataTags(t *testing.T) {
	col := Collection{Tags: []string{"  ужин  "}}
	if !HasTag(col, "Ужин") {
		t.Fatal("HasTag() = false, want true for trimmed case-insensitive match")
	}
}
