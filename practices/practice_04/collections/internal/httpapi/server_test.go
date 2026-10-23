package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"vkusvill-collections/internal/domain"
	"vkusvill-collections/internal/store"
	"vkusvill-collections/internal/testutil"
)

type fakeStore struct {
	mu              sync.Mutex
	collections     map[string]domain.Collection
	order           []string
	favorites       map[string]map[string]bool
	active          bool
	lastVisitor     string
	activePoolErr   error
	activePoolCalls int
	activePoolFn    func() ([]domain.Collection, error)
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

func (f *fakeStore) ActivePool(_ context.Context) ([]domain.Collection, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.activePoolCalls++
	if f.activePoolErr != nil {
		return nil, f.activePoolErr
	}
	if f.activePoolFn != nil {
		return f.activePoolFn()
	}
	result := make([]domain.Collection, 0, len(f.order))
	for _, id := range f.order {
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

func testCollectionWithTags(id string, tags ...string) domain.Collection {
	col := testCollection(id)
	col.Tags = tags
	return col
}

type collectionsBody struct {
	Collections []domain.Collection `json:"collections"`
	Favorites   []string            `json:"favorites"`
	Tags        []string            `json:"tags"`
	ActiveTag   string              `json:"active_tag"`
}

func getCollections(t *testing.T, st Store, rawQuery string) *httptest.ResponseRecorder {
	t.Helper()
	target := "/api/collections"
	if rawQuery != "" {
		target += "?" + rawQuery
	}
	req := httptest.NewRequest(http.MethodGet, target, nil)
	rec := httptest.NewRecorder()
	newTestHandler(st, testutil.NewFakeMCP(nil)).ServeHTTP(rec, req)
	return rec
}

func decodeCollections(t *testing.T, rec *httptest.ResponseRecorder) collectionsBody {
	t.Helper()
	var body collectionsBody
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return body
}

func equalStrings(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}
	for i := range want {
		if got[i] != want[i] {
			return false
		}
	}
	return true
}

func collectionIDs(cols []domain.Collection) []string {
	ids := make([]string, 0, len(cols))
	for _, col := range cols {
		ids = append(ids, col.ID)
	}
	return ids
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

func TestCollectionsWithoutTag(t *testing.T) {
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", "ужин", "бюджет"))
	st.add(testCollectionWithTags("c2", "завтрак"))
	st.add(testCollectionWithTags("c3", "ужин"))
	token := strings.Repeat("a", 32)
	st.favorites[token] = map[string]bool{"c2": true}

	req := httptest.NewRequest(http.MethodGet, "/api/collections", nil)
	req.AddCookie(&http.Cookie{Name: cookieName, Value: token})
	rec := httptest.NewRecorder()
	newTestHandler(st, testutil.NewFakeMCP(nil)).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	body := decodeCollections(t, rec)
	if body.ActiveTag != "" {
		t.Fatalf("active_tag = %q, want empty", body.ActiveTag)
	}
	if !equalStrings(body.Tags, []string{"бюджет", "завтрак", "ужин"}) {
		t.Fatalf("tags = %v", body.Tags)
	}
	if len(body.Collections) != 3 {
		t.Fatalf("collections = %d, want 3", len(body.Collections))
	}
	if !equalStrings(body.Favorites, []string{"c2"}) {
		t.Fatalf("favorites = %v", body.Favorites)
	}
}

func TestCollectionsFiltersKnownTag(t *testing.T) {
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", "ужин"))
	st.add(testCollectionWithTags("c2", "завтрак"))
	st.add(testCollectionWithTags("c3", "бюджет", "ужин"))

	rec := getCollections(t, st, url.Values{"tag": {"ужин"}}.Encode())
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	body := decodeCollections(t, rec)
	if body.ActiveTag != "ужин" {
		t.Fatalf("active_tag = %q, want ужин", body.ActiveTag)
	}
	if !equalStrings(body.Tags, []string{"бюджет", "завтрак", "ужин"}) {
		t.Fatalf("tags = %v, want full list", body.Tags)
	}
	ids := collectionIDs(body.Collections)
	if len(ids) != 2 || !strings.Contains(strings.Join(ids, ","), "c1") || !strings.Contains(strings.Join(ids, ","), "c3") {
		t.Fatalf("collections = %v, want c1 and c3", ids)
	}
	for _, col := range body.Collections {
		if !domain.HasTag(col, "ужин") {
			t.Fatalf("collection %s does not have tag", col.ID)
		}
	}
}

func TestCollectionsCanonicalizesCase(t *testing.T) {
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", "Ужин", "бюджет"))
	st.add(testCollectionWithTags("c2", "ужин"))
	st.add(testCollectionWithTags("c3", "завтрак"))

	for _, requested := range []string{"УЖИН", "  ужин  "} {
		rec := getCollections(t, st, url.Values{"tag": {requested}}.Encode())
		if rec.Code != http.StatusOK {
			t.Fatalf("tag %q: status = %d, body = %s", requested, rec.Code, rec.Body.String())
		}
		body := decodeCollections(t, rec)
		if body.ActiveTag != "Ужин" {
			t.Fatalf("tag %q: active_tag = %q, want Ужин", requested, body.ActiveTag)
		}
		if len(body.Collections) != 2 {
			t.Fatalf("tag %q: collections = %v, want c1 and c2", requested, collectionIDs(body.Collections))
		}
		if !equalStrings(body.Tags, []string{"Ужин", "бюджет", "завтрак"}) {
			t.Fatalf("tag %q: tags = %v", requested, body.Tags)
		}
	}
}

func TestCollectionsUnknownTagIsEmpty200(t *testing.T) {
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", "ужин"))
	st.add(testCollectionWithTags("c2", "завтрак"))
	token := strings.Repeat("b", 32)
	st.favorites[token] = map[string]bool{"c1": true}

	req := httptest.NewRequest(http.MethodGet, "/api/collections?"+url.Values{"tag": {"нет-такого"}}.Encode(), nil)
	req.AddCookie(&http.Cookie{Name: cookieName, Value: token})
	rec := httptest.NewRecorder()
	newTestHandler(st, testutil.NewFakeMCP(nil)).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	body := decodeCollections(t, rec)
	if body.ActiveTag != "нет-такого" {
		t.Fatalf("active_tag = %q, want echo", body.ActiveTag)
	}
	if len(body.Collections) != 0 {
		t.Fatalf("collections = %v, want empty", collectionIDs(body.Collections))
	}
	if !equalStrings(body.Tags, []string{"завтрак", "ужин"}) {
		t.Fatalf("tags = %v, want full list", body.Tags)
	}
	if !equalStrings(body.Favorites, []string{"c1"}) {
		t.Fatalf("favorites = %v, want full list", body.Favorites)
	}
}

func TestCollectionsKeepsFavoritesIndependent(t *testing.T) {
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", "ужин"))
	st.add(testCollectionWithTags("c2", "завтрак"))
	token := strings.Repeat("c", 32)
	st.favorites[token] = map[string]bool{"c2": true}

	withFilter := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/collections?"+url.Values{"tag": {"ужин"}}.Encode(), nil)
	req.AddCookie(&http.Cookie{Name: cookieName, Value: token})
	newTestHandler(st, testutil.NewFakeMCP(nil)).ServeHTTP(withFilter, req)
	if withFilter.Code != http.StatusOK {
		t.Fatalf("filtered status = %d", withFilter.Code)
	}
	withoutFilter := httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/collections", nil)
	req.AddCookie(&http.Cookie{Name: cookieName, Value: token})
	newTestHandler(st, testutil.NewFakeMCP(nil)).ServeHTTP(withoutFilter, req)
	if withoutFilter.Code != http.StatusOK {
		t.Fatalf("unfiltered status = %d", withoutFilter.Code)
	}

	filtered := decodeCollections(t, withFilter)
	unfiltered := decodeCollections(t, withoutFilter)
	if !equalStrings(filtered.Favorites, unfiltered.Favorites) {
		t.Fatalf("favorites differ: %v vs %v", filtered.Favorites, unfiltered.Favorites)
	}
}

func TestCollectionsSamplesWithinTag(t *testing.T) {
	st := newFakeStore()
	for i := 0; i < 15; i++ {
		st.add(testCollectionWithTags(fmt.Sprintf("dinner-%d", i), "ужин"))
	}
	st.add(testCollectionWithTags("breakfast-1", "завтрак"))
	st.add(testCollectionWithTags("breakfast-2", "завтрак"))

	rec := getCollections(t, st, url.Values{"tag": {"ужин"}}.Encode())
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	body := decodeCollections(t, rec)
	if len(body.Collections) != 12 {
		t.Fatalf("collections = %d, want PerPage 12", len(body.Collections))
	}
	seen := map[string]bool{}
	for _, col := range body.Collections {
		if !domain.HasTag(col, "ужин") {
			t.Fatalf("collection %s without tag", col.ID)
		}
		if seen[col.ID] {
			t.Fatalf("duplicate collection %s", col.ID)
		}
		seen[col.ID] = true
	}

	few := newFakeStore()
	few.add(testCollectionWithTags("dinner-1", "ужин"))
	few.add(testCollectionWithTags("dinner-2", "ужин"))
	few.add(testCollectionWithTags("dinner-3", "ужин"))
	few.add(testCollectionWithTags("breakfast-1", "завтрак"))
	body = decodeCollections(t, getCollections(t, few, url.Values{"tag": {"ужин"}}.Encode()))
	if len(body.Collections) != 3 {
		t.Fatalf("few collections = %d, want 3", len(body.Collections))
	}

	none := newFakeStore()
	none.add(testCollectionWithTags("breakfast-1", "завтрак"))
	body = decodeCollections(t, getCollections(t, none, url.Values{"tag": {"ужин"}}.Encode()))
	if len(body.Collections) != 0 {
		t.Fatalf("none collections = %d, want 0", len(body.Collections))
	}
}

func TestCollectionsEmptyTagMeansNoFilter(t *testing.T) {
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", "ужин"))

	for _, query := range []string{"", "tag=", "tag=+++", "tag=%20%09%0A"} {
		rec := getCollections(t, st, query)
		if rec.Code != http.StatusOK {
			t.Fatalf("query %q: status = %d, body = %s", query, rec.Code, rec.Body.String())
		}
		body := decodeCollections(t, rec)
		if body.ActiveTag != "" {
			t.Fatalf("query %q: active_tag = %q, want empty", query, body.ActiveTag)
		}
		if len(body.Collections) != 1 {
			t.Fatalf("query %q: collections = %d, want 1", query, len(body.Collections))
		}
	}
}

func TestCollectionsRejectsRepeatedTagBeforeStore(t *testing.T) {
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", "ужин"))

	rec := getCollections(t, st, url.Values{"tag": {"ужин", "обед"}}.Encode())
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["error"] == "" {
		t.Fatalf("body = %v, want error", body)
	}
	if st.activePoolCalls != 0 {
		t.Fatalf("ActivePool called %d times, want 0", st.activePoolCalls)
	}
}

func TestCollectionsTagLengthBoundary(t *testing.T) {
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", "ужин"))

	rec := getCollections(t, st, url.Values{"tag": {strings.Repeat("я", 64)}}.Encode())
	if rec.Code != http.StatusOK {
		t.Fatalf("64 chars: status = %d, body = %s", rec.Code, rec.Body.String())
	}

	rec = getCollections(t, st, url.Values{"tag": {strings.Repeat("я", 65)}}.Encode())
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("65 chars: status = %d, want 400", rec.Code)
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["error"] == "" {
		t.Fatalf("65 chars: body = %v, want error", body)
	}
	if st.activePoolCalls != 1 {
		t.Fatalf("ActivePool called %d times, want 1", st.activePoolCalls)
	}
}

func TestCollectionsRejectsInvalidQueryBeforeStore(t *testing.T) {
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", "ужин"))

	rec := getCollections(t, st, "tag=%zz")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["error"] != "invalid query" {
		t.Fatalf("error = %q, want invalid query", body["error"])
	}
	if st.activePoolCalls != 0 {
		t.Fatalf("ActivePool called %d times, want 0", st.activePoolCalls)
	}
}

func TestCollectionsRejectsInvalidUTF8BeforeStore(t *testing.T) {
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", "ужин"))

	rec := getCollections(t, st, "tag=%FF")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["error"] != "tag must be valid UTF-8" {
		t.Fatalf("error = %q, want tag must be valid UTF-8", body["error"])
	}
	if st.activePoolCalls != 0 {
		t.Fatalf("ActivePool called %d times, want 0", st.activePoolCalls)
	}
}

func TestCollectionsCallsActivePoolOnce(t *testing.T) {
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", "ужин"))
	st.add(testCollectionWithTags("c2", "завтрак"))

	rec := getCollections(t, st, url.Values{"tag": {"ужин"}}.Encode())
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if st.activePoolCalls != 1 {
		t.Fatalf("ActivePool called %d times, want 1", st.activePoolCalls)
	}
}

func TestCollectionsBuildsTagsAndCollectionsFromSingleActivePool(t *testing.T) {
	pools := [][]domain.Collection{
		{
			testCollectionWithTags("c1", "ужин"),
			testCollectionWithTags("c2", "завтрак"),
		},
		{
			testCollectionWithTags("c3", "обед"),
		},
	}
	calls := 0
	st := newFakeStore()
	st.activePoolFn = func() ([]domain.Collection, error) {
		call := calls
		calls++
		if call >= len(pools) {
			return nil, errors.New("unexpected ActivePool call")
		}
		return pools[call], nil
	}

	rec := getCollections(t, st, url.Values{"tag": {"ужин"}}.Encode())
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if st.activePoolCalls != 1 {
		t.Fatalf("ActivePool called %d times, want 1", st.activePoolCalls)
	}
	body := decodeCollections(t, rec)
	if !equalStrings(body.Tags, []string{"завтрак", "ужин"}) {
		t.Fatalf("tags = %v, want tags from the first pool", body.Tags)
	}
	if ids := collectionIDs(body.Collections); len(ids) != 1 || ids[0] != "c1" {
		t.Fatalf("collections = %v, want [c1]", ids)
	}
}

func TestCollectionsTreatsInnerWhitespaceAsSignificant(t *testing.T) {
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", "ужин на двоих"))
	st.add(testCollectionWithTags("c2", "ужин"))

	short := decodeCollections(t, getCollections(t, st, url.Values{"tag": {"ужин"}}.Encode()))
	if short.ActiveTag != "ужин" {
		t.Fatalf("short active_tag = %q, want ужин", short.ActiveTag)
	}
	if ids := collectionIDs(short.Collections); len(ids) != 1 || ids[0] != "c2" {
		t.Fatalf("short collections = %v, want [c2]", ids)
	}

	long := decodeCollections(t, getCollections(t, st, url.Values{"tag": {"ужин на двоих"}}.Encode()))
	if long.ActiveTag != "ужин на двоих" {
		t.Fatalf("long active_tag = %q, want ужин на двоих", long.ActiveTag)
	}
	if ids := collectionIDs(long.Collections); len(ids) != 1 || ids[0] != "c1" {
		t.Fatalf("long collections = %v, want [c1]", ids)
	}
}

func TestCollectionsMatchesDataTagWithOuterSpaces(t *testing.T) {
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", "  ужин на двоих  "))
	st.add(testCollectionWithTags("c2", "ужин"))

	body := decodeCollections(t, getCollections(t, st, url.Values{"tag": {"ужин на двоих"}}.Encode()))
	if body.ActiveTag != "ужин на двоих" {
		t.Fatalf("active_tag = %q, want ужин на двоих", body.ActiveTag)
	}
	if ids := collectionIDs(body.Collections); len(ids) != 1 || ids[0] != "c1" {
		t.Fatalf("collections = %v, want [c1]", ids)
	}
}

func TestCollectionsUnknownTagEchoesTrimmedValue(t *testing.T) {
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", "ужин"))

	body := decodeCollections(t, getCollections(t, st, url.Values{"tag": {"  нет-такого \t"}}.Encode()))
	if body.ActiveTag != "нет-такого" {
		t.Fatalf("active_tag = %q, want нет-такого", body.ActiveTag)
	}
	if len(body.Collections) != 0 {
		t.Fatalf("collections = %v, want empty", collectionIDs(body.Collections))
	}
	if !equalStrings(body.Tags, []string{"ужин"}) {
		t.Fatalf("tags = %v, want full list", body.Tags)
	}
}

func TestCollectionsAllowsNULAndControlCharacters(t *testing.T) {
	tags := []string{"a\x00b\x01c", "\x00", "\x01\x1f"}
	sortedTags := []string{"\x00", "\x01\x1f", "a\x00b\x01c"}
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", tags...))

	for _, tag := range tags {
		rec := getCollections(t, st, url.Values{"tag": {tag}}.Encode())
		if rec.Code != http.StatusOK {
			t.Fatalf("tag %q: status = %d, body = %s", tag, rec.Code, rec.Body.String())
		}
		body := decodeCollections(t, rec)
		if body.ActiveTag != tag {
			t.Fatalf("tag %q: active_tag = %q, want echo", tag, body.ActiveTag)
		}
		if ids := collectionIDs(body.Collections); len(ids) != 1 || ids[0] != "c1" {
			t.Fatalf("tag %q: collections = %v, want [c1]", tag, ids)
		}
		if !equalStrings(body.Tags, sortedTags) {
			t.Fatalf("tag %q: tags = %v, want %v", tag, body.Tags, sortedTags)
		}
	}
}

func TestCollectionsBadRequestOmitsCollections(t *testing.T) {
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", "ужин"))

	cases := map[string]string{
		"repeated tag":  url.Values{"tag": {"ужин", "обед"}}.Encode(),
		"too long tag":  url.Values{"tag": {strings.Repeat("я", 65)}}.Encode(),
		"invalid query": "tag=%zz",
		"invalid UTF-8": "tag=%FF",
	}
	for name, query := range cases {
		t.Run(name, func(t *testing.T) {
			rec := getCollections(t, st, query)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400, body = %s", rec.Code, rec.Body.String())
			}
			var body map[string]json.RawMessage
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			if _, ok := body["collections"]; ok {
				t.Fatalf("400 body must not contain collections: %v", body)
			}
			if _, ok := body["error"]; !ok {
				t.Fatalf("400 body must contain error: %v", body)
			}
		})
	}
	if st.activePoolCalls != 0 {
		t.Fatalf("ActivePool called %d times, want 0", st.activePoolCalls)
	}
}

func TestCollectionsTagsOrderIsStable(t *testing.T) {
	st := newFakeStore()
	st.add(testCollectionWithTags("c1", "ужин", "бюджет"))
	st.add(testCollectionWithTags("c2", "завтрак", "ужин"))

	first := decodeCollections(t, getCollections(t, st, ""))
	second := decodeCollections(t, getCollections(t, st, ""))

	want := []string{"бюджет", "завтрак", "ужин"}
	if !equalStrings(first.Tags, want) {
		t.Fatalf("first tags = %v, want %v", first.Tags, want)
	}
	if !equalStrings(second.Tags, first.Tags) {
		t.Fatalf("second tags = %v, want %v", second.Tags, first.Tags)
	}
}

func TestCollectionsStoreError(t *testing.T) {
	st := newFakeStore()
	st.activePoolErr = errors.New("database is down")

	rec := getCollections(t, st, "")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var body map[string]json.RawMessage
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if _, ok := body["error"]; !ok {
		t.Fatalf("body = %v, want error field", body)
	}
	if _, ok := body["collections"]; ok {
		t.Fatalf("500 body must not contain collections: %v", body)
	}
}

func TestCollectionsArraysAreNotNull(t *testing.T) {
	st := newFakeStore()

	rec := getCollections(t, st, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var body map[string]json.RawMessage
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	for _, field := range []string{"collections", "tags", "favorites"} {
		raw, ok := body[field]
		if !ok {
			t.Fatalf("missing field %q", field)
		}
		if string(raw) == "null" {
			t.Fatalf("%s is null, want []", field)
		}
		if string(raw) != "[]" {
			t.Fatalf("%s = %s, want []", field, raw)
		}
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
