package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"vkusvill-collections/internal/domain"
	"vkusvill-collections/internal/store"
	"vkusvill-collections/internal/testutil"
)

type fakeStore struct {
	mu          sync.Mutex
	collections map[string]domain.Collection
	order       []string
	favorites   map[string]map[string]bool
	active      bool
	lastVisitor string
}

func newFakeStore() *fakeStore {
	return &fakeStore{
		collections: map[string]domain.Collection{},
		favorites:   map[string]map[string]bool{},
		active:      true,
	}
}

func (f *fakeStore) add(col domain.Collection) {
	f.collections[col.ID] = col
	f.order = append(f.order, col.ID)
}

func (f *fakeStore) SampleActive(_ context.Context, limit int) ([]domain.Collection, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	result := make([]domain.Collection, 0, limit)
	for _, id := range f.order {
		if len(result) == limit {
			break
		}
		result = append(result, f.collections[id])
	}
	return result, nil
}

func (f *fakeStore) Get(_ context.Context, id string) (domain.Collection, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	col, ok := f.collections[id]
	if !ok {
		return domain.Collection{}, store.ErrNotFound
	}
	return col, nil
}

func (f *fakeStore) ListFavorites(_ context.Context, visitorID string) ([]domain.Collection, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	ids := f.favorites[visitorID]
	result := make([]domain.Collection, 0, len(ids))
	for _, id := range f.order {
		if ids[id] {
			result = append(result, f.collections[id])
		}
	}
	return result, nil
}

func (f *fakeStore) AddFavorite(_ context.Context, visitorID, collectionID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lastVisitor = visitorID
	if _, ok := f.collections[collectionID]; !ok {
		return store.ErrNotFound
	}
	if f.favorites[visitorID] == nil {
		f.favorites[visitorID] = map[string]bool{}
	}
	f.favorites[visitorID][collectionID] = true
	return nil
}

func (f *fakeStore) RemoveFavorite(_ context.Context, visitorID, collectionID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lastVisitor = visitorID
	delete(f.favorites[visitorID], collectionID)
	return nil
}

func (f *fakeStore) SetCartURL(_ context.Context, id, url string, at time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	col, ok := f.collections[id]
	if !ok {
		return store.ErrNotFound
	}
	col.CartURL = url
	col.CartSetAt = at
	f.collections[id] = col
	return nil
}

func (f *fakeStore) HasActive(context.Context) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.active, nil
}

func newTestHandler(st Store, cart CartClient) http.Handler {
	return New(st, cart, nil, Config{
		PerPage:     12,
		CartLinkTTL: 24 * time.Hour,
		Now:         func() time.Time { return time.Unix(1700000000, 0).UTC() },
	}, nil)
}

func testCollection(id string) domain.Collection {
	return domain.Collection{
		ID:       id,
		Slug:     id,
		Title:    "Подборка " + id,
		Subtitle: "Описание",
		Total:    300,
		Items: []domain.Product{
			{ID: 1, Name: "Товар", Price: 100, Unit: "шт", Quantity: 1},
		},
	}
}

func TestCollectionsReturnsFavorites(t *testing.T) {
	st := newFakeStore()
	st.add(testCollection("c1"))
	st.add(testCollection("c2"))
	token := strings.Repeat("a", 32)
	st.favorites[token] = map[string]bool{"c1": true}

	req := httptest.NewRequest(http.MethodGet, "/api/collections", nil)
	req.AddCookie(&http.Cookie{Name: cookieName, Value: token})
	rec := httptest.NewRecorder()
	newTestHandler(st, testutil.NewFakeMCP(nil)).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var body struct {
		Collections []domain.Collection `json:"collections"`
		Favorites   []string            `json:"favorites"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Collections) != 2 {
		t.Fatalf("collections = %d", len(body.Collections))
	}
	if len(body.Favorites) != 1 || body.Favorites[0] != "c1" {
		t.Fatalf("favorites = %v", body.Favorites)
	}
}

func TestVisitorCookieIsIssuedAndStable(t *testing.T) {
	st := newFakeStore()
	st.add(testCollection("c1"))
	handler := newTestHandler(st, testutil.NewFakeMCP(nil))

	req := httptest.NewRequest(http.MethodPut, "/api/favorites/c1", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	cookies := rec.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != cookieName {
		t.Fatalf("cookies = %v", cookies)
	}
	st.mu.Lock()
	used := st.lastVisitor
	st.mu.Unlock()
	if used != cookies[0].Value {
		t.Fatalf("visitor %q != cookie %q", used, cookies[0].Value)
	}
}

func TestAddMissingFavoriteReturns404(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/api/favorites/missing", nil)
	rec := httptest.NewRecorder()
	newTestHandler(newFakeStore(), testutil.NewFakeMCP(nil)).ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestCartLinkUsesCache(t *testing.T) {
	st := newFakeStore()
	col := testCollection("c1")
	col.CartURL = "https://vkusvill.ru/mobile?basket&share=1"
	col.CartSetAt = time.Unix(1700000000, 0).UTC().Add(-time.Hour)
	st.add(col)

	fake := testutil.NewFakeMCP(nil)
	fake.CartURL = "https://vkusvill.ru/mobile?basket&share=2"
	req := httptest.NewRequest(http.MethodPost, "/api/collections/c1/cart", nil)
	rec := httptest.NewRecorder()
	newTestHandler(st, fake).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var body map[string]string
	_ = json.NewDecoder(rec.Body).Decode(&body)
	if body["url"] != col.CartURL {
		t.Fatalf("url = %q, want cached %q", body["url"], col.CartURL)
	}
	if fake.CartCalls != 0 {
		t.Fatalf("cart calls = %d", fake.CartCalls)
	}
}

func TestCartLinkCreatesAndStores(t *testing.T) {
	st := newFakeStore()
	st.add(testCollection("c1"))

	fake := testutil.NewFakeMCP(nil)
	fake.CartURL = "https://vkusvill.ru/mobile?basket&share=42"
	req := httptest.NewRequest(http.MethodPost, "/api/collections/c1/cart", nil)
	rec := httptest.NewRecorder()
	newTestHandler(st, fake).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var body map[string]string
	_ = json.NewDecoder(rec.Body).Decode(&body)
	if body["url"] != fake.CartURL {
		t.Fatalf("url = %q", body["url"])
	}
	if fake.CartCalls != 1 {
		t.Fatalf("cart calls = %d", fake.CartCalls)
	}
	st.mu.Lock()
	stored := st.collections["c1"].CartURL
	st.mu.Unlock()
	if stored != fake.CartURL {
		t.Fatalf("stored url = %q", stored)
	}
}

func TestCartLinkRejectsForeignURL(t *testing.T) {
	st := newFakeStore()
	st.add(testCollection("c1"))
	fake := testutil.NewFakeMCP(nil)
	fake.CartURL = "https://example.com/cart"

	req := httptest.NewRequest(http.MethodPost, "/api/collections/c1/cart", nil)
	rec := httptest.NewRecorder()
	newTestHandler(st, fake).ServeHTTP(rec, req)

	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502", rec.Code)
	}
}

func TestCartLinkMissingCollection(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/collections/missing/cart", nil)
	rec := httptest.NewRecorder()
	newTestHandler(newFakeStore(), testutil.NewFakeMCP(nil)).ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestReadyz(t *testing.T) {
	st := newFakeStore()
	handler := newTestHandler(st, testutil.NewFakeMCP(nil))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	st.active = false
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
}

func TestCartErrorReturnsBadGateway(t *testing.T) {
	st := newFakeStore()
	st.add(testCollection("c1"))
	fake := testutil.NewFakeMCP(nil)
	fake.Err = errors.New("upstream failed")

	req := httptest.NewRequest(http.MethodPost, "/api/collections/c1/cart", nil)
	rec := httptest.NewRecorder()
	newTestHandler(st, fake).ServeHTTP(rec, req)

	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502", rec.Code)
	}
}
