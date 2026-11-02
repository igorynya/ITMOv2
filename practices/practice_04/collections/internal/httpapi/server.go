package httpapi

import (
	"context"
	cryptorand "crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io/fs"
	"log/slog"
	mathrand "math/rand"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"vkusvill-collections/internal/domain"
	"vkusvill-collections/internal/store"
)

const (
	visitorKey = "visitor_id"
	cookieName = "vv_visitor"
)

type Store interface {
	ActivePool(ctx context.Context) ([]domain.Collection, error)
	Get(ctx context.Context, id string) (domain.Collection, error)
	ListFavorites(ctx context.Context, visitorID string) ([]domain.Collection, error)
	AddFavorite(ctx context.Context, visitorID, collectionID string) error
	RemoveFavorite(ctx context.Context, visitorID, collectionID string) error
	SetCartURL(ctx context.Context, id, url string, at time.Time) error
	HasActive(ctx context.Context) (bool, error)
}

type CartClient interface {
	CreateCartLink(ctx context.Context, items []domain.CartItem) (string, error)
}

type Config struct {
	PerPage      int
	CartLinkTTL  time.Duration
	CartTimeout  time.Duration
	CookieMaxAge int
	Now          func() time.Time
}

type server struct {
	store  Store
	cart   CartClient
	static fs.FS
	cfg    Config
	logger *slog.Logger
}

func New(st Store, cart CartClient, static fs.FS, cfg Config, logger *slog.Logger) http.Handler {
	if cfg.PerPage <= 0 {
		cfg.PerPage = 12
	}
	if cfg.CartLinkTTL <= 0 {
		cfg.CartLinkTTL = 24 * time.Hour
	}
	if cfg.CartTimeout <= 0 {
		cfg.CartTimeout = 25 * time.Second
	}
	if cfg.CookieMaxAge <= 0 {
		cfg.CookieMaxAge = 365 * 24 * 60 * 60
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	if logger == nil {
		logger = slog.Default()
	}

	s := &server{store: st, cart: cart, static: static, cfg: cfg, logger: logger}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.healthz)
	mux.HandleFunc("GET /readyz", s.readyz)
	mux.HandleFunc("GET /api/collections", s.collections)
	mux.HandleFunc("GET /api/favorites", s.favorites)
	mux.HandleFunc("PUT /api/favorites/{id}", s.addFavorite)
	mux.HandleFunc("DELETE /api/favorites/{id}", s.removeFavorite)
	mux.HandleFunc("POST /api/collections/{id}/cart", s.cartLink)
	if static != nil {
		mux.Handle("GET /", http.FileServerFS(static))
	}

	return s.recoverer(s.logRequests(s.visitor(mux)))
}

func (s *server) collections(w http.ResponseWriter, r *http.Request) {
	query, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid query")
		return
	}
	values := query["tag"]
	if len(values) > 1 {
		writeError(w, http.StatusBadRequest, "tag must be specified once")
		return
	}
	raw := ""
	if len(values) == 1 {
		raw = values[0]
	}
	if !utf8.ValidString(raw) {
		writeError(w, http.StatusBadRequest, "tag must be valid UTF-8")
		return
	}
	requested := domain.TrimTag(raw)
	if requested != "" && utf8.RuneCountInString(requested) > domain.MaxTagLength {
		writeError(w, http.StatusBadRequest, "tag is too long")
		return
	}

	visitor := visitorFrom(r.Context())

	pool, err := s.store.ActivePool(r.Context())
	if err != nil {
		s.fail(w, http.StatusInternalServerError, "cannot load collections", err)
		return
	}
	tags := domain.AvailableTags(pool)

	activeTag := ""
	selectedTag := ""
	unknown := false
	if requested != "" {
		canonical, ok := domain.ResolveTag(tags, requested)
		if ok {
			activeTag = canonical
			selectedTag = canonical
		} else {
			activeTag = requested
			unknown = true
		}
	}

	filtered := pool
	if selectedTag != "" {
		filtered = make([]domain.Collection, 0, len(pool))
		for _, col := range pool {
			if domain.HasTag(col, selectedTag) {
				filtered = append(filtered, col)
			}
		}
	}
	if unknown {
		filtered = []domain.Collection{}
	}
	collections := sampleCollections(filtered, s.cfg.PerPage)

	favorites, err := s.store.ListFavorites(r.Context(), visitor)
	if err != nil {
		s.fail(w, http.StatusInternalServerError, "cannot load favorites", err)
		return
	}

	ids := make([]string, 0, len(favorites))
	for _, col := range favorites {
		ids = append(ids, col.ID)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"collections": collections,
		"favorites":   ids,
		"tags":        tags,
		"active_tag":  activeTag,
	})
}

func (s *server) favorites(w http.ResponseWriter, r *http.Request) {
	collections, err := s.store.ListFavorites(r.Context(), visitorFrom(r.Context()))
	if err != nil {
		s.fail(w, http.StatusInternalServerError, "cannot load favorites", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"collections": collections})
}

func (s *server) addFavorite(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "collection id is required")
		return
	}

	err := s.store.AddFavorite(r.Context(), visitorFrom(r.Context()), id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "collection not found")
		return
	}
	if err != nil {
		s.fail(w, http.StatusInternalServerError, "cannot add favorite", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"favorite": true, "id": id})
}

func (s *server) removeFavorite(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "collection id is required")
		return
	}

	if err := s.store.RemoveFavorite(r.Context(), visitorFrom(r.Context()), id); err != nil {
		s.fail(w, http.StatusInternalServerError, "cannot remove favorite", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"favorite": false, "id": id})
}

func (s *server) cartLink(w http.ResponseWriter, r *http.Request) {
	col, err := s.store.Get(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "collection not found")
		return
	}
	if err != nil {
		s.fail(w, http.StatusInternalServerError, "cannot load collection", err)
		return
	}

	now := s.cfg.Now().UTC()
	if col.CartURL != "" && now.Sub(col.CartSetAt) < s.cfg.CartLinkTTL {
		writeJSON(w, http.StatusOK, map[string]any{"url": col.CartURL})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), s.cfg.CartTimeout)
	defer cancel()

	url, err := s.cart.CreateCartLink(ctx, col.CartItems())
	if err != nil {
		s.fail(w, http.StatusBadGateway, "cannot create cart link", err)
		return
	}
	if !strings.HasPrefix(url, "https://vkusvill.ru/") {
		s.fail(w, http.StatusBadGateway, "unexpected cart link", errors.New("unexpected cart link"))
		return
	}

	if err := s.store.SetCartURL(ctx, col.ID, url, now); err != nil {
		s.logger.Warn("save cart link", "collection", col.ID, "error", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"url": url})
}

func (s *server) healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("ok\n"))
}

func (s *server) readyz(w http.ResponseWriter, r *http.Request) {
	ok, err := s.store.HasActive(r.Context())
	if err != nil || !ok {
		writeError(w, http.StatusServiceUnavailable, "not ready")
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("ready\n"))
}

func (s *server) fail(w http.ResponseWriter, status int, message string, err error) {
	s.logger.Error(message, "error", err, "status", status)
	writeError(w, status, message)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func sampleCollections(cols []domain.Collection, limit int) []domain.Collection {
	if limit <= 0 || len(cols) == 0 {
		return []domain.Collection{}
	}
	sampled := append([]domain.Collection(nil), cols...)
	mathrand.Shuffle(len(sampled), func(i, j int) {
		sampled[i], sampled[j] = sampled[j], sampled[i]
	})
	if len(sampled) > limit {
		sampled = sampled[:limit]
	}
	return sampled
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func (s *server) visitor(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := ""
		if cookie, err := r.Cookie(cookieName); err == nil && validToken(cookie.Value) {
			token = cookie.Value
		}
		if token == "" {
			var err error
			token, err = newToken()
			if err != nil {
				writeError(w, http.StatusInternalServerError, "cannot start session")
				return
			}
			http.SetCookie(w, &http.Cookie{
				Name:     cookieName,
				Value:    token,
				Path:     "/",
				MaxAge:   s.cfg.CookieMaxAge,
				HttpOnly: true,
				SameSite: http.SameSiteLaxMode,
			})
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), visitorKey, token)))
	})
}

func (s *server) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		s.logger.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"duration", time.Since(start).Round(time.Millisecond),
		)
	})
}

func (s *server) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				s.logger.Error("panic", "value", recovered, "path", r.URL.Path)
				writeError(w, http.StatusInternalServerError, "internal error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func visitorFrom(ctx context.Context) string {
	visitor, _ := ctx.Value(visitorKey).(string)
	return visitor
}

func newToken() (string, error) {
	raw := make([]byte, 16)
	if _, err := cryptorand.Read(raw); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw), nil
}

func validToken(token string) bool {
	if len(token) != 32 {
		return false
	}
	_, err := hex.DecodeString(token)
	return err == nil
}
