package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"

	"vkusvill-collections/internal/domain"
)

var ErrNotFound = errors.New("not found")

const schema = `
CREATE TABLE IF NOT EXISTS collections (
	id          TEXT PRIMARY KEY,
	slug        TEXT NOT NULL,
	title       TEXT NOT NULL,
	subtitle    TEXT NOT NULL,
	template    TEXT NOT NULL,
	budget      INTEGER NOT NULL,
	total       INTEGER NOT NULL,
	items       TEXT NOT NULL,
	tags        TEXT NOT NULL,
	cart_url    TEXT NOT NULL DEFAULT '',
	cart_set_at INTEGER NOT NULL DEFAULT 0,
	generation  INTEGER NOT NULL,
	active      INTEGER NOT NULL DEFAULT 1,
	created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_collections_active ON collections(active, generation);
CREATE INDEX IF NOT EXISTS idx_collections_created ON collections(created_at);

CREATE TABLE IF NOT EXISTS favorites (
	visitor_id    TEXT NOT NULL,
	collection_id TEXT NOT NULL,
	created_at    INTEGER NOT NULL,
	PRIMARY KEY (visitor_id, collection_id),
	FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_favorites_visitor ON favorites(visitor_id, created_at);

CREATE TABLE IF NOT EXISTS meta (
	key   TEXT PRIMARY KEY,
	value TEXT NOT NULL
);
`

type Store struct {
	db *sql.DB
}

func Open(path string) (*Store, error) {
	if dir := filepath.Dir(path); dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("create database directory: %w", err)
		}
	}

	dsn := "file:" + path + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	db.SetMaxOpenConns(4)
	db.SetMaxIdleConns(4)

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return &Store{db: db}, nil
}

func (s *Store) Migrate(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, schema); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) SaveGeneration(ctx context.Context, generation int64, cols []domain.Collection) error {
	if generation <= 0 {
		return errors.New("generation must be positive")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin generation: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `UPDATE collections SET active = 0 WHERE active = 1`); err != nil {
		return fmt.Errorf("deactivate generation: %w", err)
	}

	now := time.Now().UTC()
	for _, col := range cols {
		if col.ID == "" {
			return errors.New("collection id must not be empty")
		}
		items, err := json.Marshal(nonNilProducts(col.Items))
		if err != nil {
			return fmt.Errorf("marshal items: %w", err)
		}
		tags := col.Tags
		if tags == nil {
			tags = []string{}
		}
		tagsJSON, err := json.Marshal(tags)
		if err != nil {
			return fmt.Errorf("marshal tags: %w", err)
		}
		createdAt := col.CreatedAt
		if createdAt.IsZero() {
			createdAt = now
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO collections
				(id, slug, title, subtitle, template, budget, total, items, tags,
				 cart_url, cart_set_at, generation, active, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', 0, ?, 1, ?)
			ON CONFLICT(id) DO UPDATE SET
				slug = excluded.slug,
				title = excluded.title,
				subtitle = excluded.subtitle,
				template = excluded.template,
				budget = excluded.budget,
				total = excluded.total,
				items = excluded.items,
				tags = excluded.tags,
				generation = excluded.generation,
				active = 1,
				created_at = excluded.created_at`,
			col.ID, col.Slug, col.Title, col.Subtitle, col.Template,
			col.Budget, col.Total, string(items), string(tagsJSON),
			generation, createdAt.Unix(),
		); err != nil {
			return fmt.Errorf("insert collection %s: %w", col.ID, err)
		}
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO meta(key, value) VALUES ('last_generation', ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		fmt.Sprintf("%d", generation),
	); err != nil {
		return fmt.Errorf("save generation meta: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit generation: %w", err)
	}
	return nil
}

func (s *Store) SampleActive(ctx context.Context, limit int) ([]domain.Collection, error) {
	if limit <= 0 {
		return []domain.Collection{}, nil
	}
	rows, err := s.db.QueryContext(ctx, collectionSelect+`
		WHERE active = 1 ORDER BY RANDOM() LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("sample collections: %w", err)
	}
	defer rows.Close()
	return scanCollections(rows)
}

func (s *Store) Get(ctx context.Context, id string) (domain.Collection, error) {
	row := s.db.QueryRowContext(ctx, collectionSelect+` WHERE id = ?`, id)
	col, err := scanCollection(row)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Collection{}, ErrNotFound
	}
	if err != nil {
		return domain.Collection{}, fmt.Errorf("get collection: %w", err)
	}
	return col, nil
}

func (s *Store) ListFavorites(ctx context.Context, visitorID string) ([]domain.Collection, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT c.id, c.slug, c.title, c.subtitle, c.template, c.budget, c.total,
		       c.items, c.tags, c.cart_url, c.cart_set_at, c.generation, c.active, c.created_at
		FROM favorites f
		JOIN collections c ON c.id = f.collection_id
		WHERE f.visitor_id = ?
		ORDER BY f.created_at DESC`, visitorID)
	if err != nil {
		return nil, fmt.Errorf("list favorites: %w", err)
	}
	defer rows.Close()
	return scanCollections(rows)
}

func (s *Store) AddFavorite(ctx context.Context, visitorID, collectionID string) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO favorites(visitor_id, collection_id, created_at)
		VALUES (?, ?, ?)
		ON CONFLICT(visitor_id, collection_id) DO NOTHING`,
		visitorID, collectionID, time.Now().UTC().Unix(),
	)
	if err != nil {
		if strings.Contains(err.Error(), "FOREIGN KEY") {
			return ErrNotFound
		}
		return fmt.Errorf("add favorite: %w", err)
	}
	return nil
}

func (s *Store) RemoveFavorite(ctx context.Context, visitorID, collectionID string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM favorites WHERE visitor_id = ? AND collection_id = ?`,
		visitorID, collectionID,
	)
	if err != nil {
		return fmt.Errorf("remove favorite: %w", err)
	}
	return nil
}

func (s *Store) SetCartURL(ctx context.Context, id, url string, at time.Time) error {
	res, err := s.db.ExecContext(ctx,
		`UPDATE collections SET cart_url = ?, cart_set_at = ? WHERE id = ?`,
		url, at.UTC().Unix(), id,
	)
	if err != nil {
		return fmt.Errorf("set cart url: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("set cart url rows: %w", err)
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) LastGeneration(ctx context.Context) (int64, error) {
	var raw string
	err := s.db.QueryRowContext(ctx,
		`SELECT value FROM meta WHERE key = 'last_generation'`).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("last generation: %w", err)
	}
	var generation int64
	if _, err := fmt.Sscan(raw, &generation); err != nil {
		return 0, fmt.Errorf("parse last generation: %w", err)
	}
	return generation, nil
}

func (s *Store) HasActive(ctx context.Context) (bool, error) {
	var exists int
	err := s.db.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM collections WHERE active = 1)`).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("has active: %w", err)
	}
	return exists == 1, nil
}

func (s *Store) Cleanup(ctx context.Context, before time.Time) error {
	_, err := s.db.ExecContext(ctx, `
		DELETE FROM collections
		WHERE active = 0
		  AND created_at < ?
		  AND id NOT IN (SELECT collection_id FROM favorites)`,
		before.UTC().Unix(),
	)
	if err != nil {
		return fmt.Errorf("cleanup collections: %w", err)
	}
	return nil
}

const collectionSelect = `
	SELECT id, slug, title, subtitle, template, budget, total,
	       items, tags, cart_url, cart_set_at, generation, active, created_at
	FROM collections`

type scanner interface {
	Scan(dest ...any) error
}

func scanCollection(row scanner) (domain.Collection, error) {
	var (
		col        domain.Collection
		itemsJSON  string
		tagsJSON   string
		cartSetAt  int64
		createdAt  int64
		activeFlag int
	)
	err := row.Scan(
		&col.ID, &col.Slug, &col.Title, &col.Subtitle, &col.Template,
		&col.Budget, &col.Total, &itemsJSON, &tagsJSON, &col.CartURL,
		&cartSetAt, &col.Generation, &activeFlag, &createdAt,
	)
	if err != nil {
		return domain.Collection{}, err
	}
	if err := json.Unmarshal([]byte(itemsJSON), &col.Items); err != nil {
		return domain.Collection{}, fmt.Errorf("decode items: %w", err)
	}
	if err := json.Unmarshal([]byte(tagsJSON), &col.Tags); err != nil {
		return domain.Collection{}, fmt.Errorf("decode tags: %w", err)
	}
	if col.Items == nil {
		col.Items = []domain.Product{}
	}
	if col.Tags == nil {
		col.Tags = []string{}
	}
	col.Active = activeFlag == 1
	col.CreatedAt = time.Unix(createdAt, 0).UTC()
	if cartSetAt > 0 {
		col.CartSetAt = time.Unix(cartSetAt, 0).UTC()
	}
	return col, nil
}

func scanCollections(rows *sql.Rows) ([]domain.Collection, error) {
	collections := []domain.Collection{}
	for rows.Next() {
		col, err := scanCollection(rows)
		if err != nil {
			return nil, fmt.Errorf("scan collection: %w", err)
		}
		collections = append(collections, col)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate collections: %w", err)
	}
	return collections, nil
}

func nonNilProducts(items []domain.Product) []domain.Product {
	if items == nil {
		return []domain.Product{}
	}
	return items
}
