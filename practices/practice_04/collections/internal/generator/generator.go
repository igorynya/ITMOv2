package generator

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"time"

	"vkusvill-collections/internal/domain"
	"vkusvill-collections/internal/mcp"
)

const minCollections = 10

type Options struct {
	MinRating   float64
	SearchLimit int
	Now         func() time.Time
}

type Generator struct {
	client mcp.Client
	opts   Options
}

type candidate struct {
	Product  domain.Product
	Optional bool
}

func New(client mcp.Client, opts Options) *Generator {
	if opts.MinRating <= 0 {
		opts.MinRating = 4.5
	}
	if opts.SearchLimit <= 0 {
		opts.SearchLimit = 10
	}
	if opts.Now == nil {
		opts.Now = time.Now
	}
	return &Generator{client: client, opts: opts}
}

func (g *Generator) Generate(ctx context.Context) ([]domain.Collection, error) {
	now := g.opts.Now().UTC()
	generation := now.Unix()
	cache := map[string][]domain.Product{}
	collections := make([]domain.Collection, 0, len(Templates()))

	for _, tmpl := range Templates() {
		col, err := g.build(ctx, tmpl, generation, now, cache)
		if err != nil {
			slog.Warn("skip collection", "template", tmpl.Slug, "error", err)
			continue
		}
		collections = append(collections, col)
	}

	if len(collections) < minCollections {
		return nil, fmt.Errorf("generated %d collections, need at least %d", len(collections), minCollections)
	}
	return collections, nil
}

func (g *Generator) build(ctx context.Context, tmpl Template, generation int64, now time.Time, cache map[string][]domain.Product) (domain.Collection, error) {
	used := map[int]bool{}
	candidates := make([]candidate, 0, len(tmpl.Items))

	for _, item := range tmpl.Items {
		if err := ctx.Err(); err != nil {
			return domain.Collection{}, err
		}

		products, ok := cache[item.Query]
		if !ok {
			var err error
			products, err = g.client.SearchProducts(ctx, item.Query, g.opts.SearchLimit, "popularity")
			if err != nil {
				return domain.Collection{}, fmt.Errorf("search %q: %w", item.Query, err)
			}
			cache[item.Query] = products
		}

		minRating := item.MinRating
		if minRating <= 0 {
			minRating = g.opts.MinRating
		}
		product, ok := pickCandidate(products, minRating, used)
		if !ok {
			if item.Optional {
				continue
			}
			return domain.Collection{}, fmt.Errorf("no product for %q", item.Query)
		}
		if item.Quantity > 0 {
			product.Quantity = item.Quantity
		} else {
			product.Quantity = 1
		}
		used[product.ID] = true
		candidates = append(candidates, candidate{Product: product, Optional: item.Optional})
	}

	if len(candidates) < 3 {
		return domain.Collection{}, errors.New("fewer than three products")
	}

	products := candidatesToProducts(candidates)
	if tmpl.Budget > 0 {
		fitted, ok := fitBudget(candidates, tmpl.Budget)
		if !ok {
			return domain.Collection{}, fmt.Errorf("cannot fit budget %d", tmpl.Budget)
		}
		products = fitted
	}

	return domain.Collection{
		ID:         fmt.Sprintf("%s-%d", tmpl.Slug, generation),
		Slug:       tmpl.Slug,
		Title:      tmpl.Title,
		Subtitle:   tmpl.Subtitle,
		Template:   tmpl.Slug,
		Budget:     tmpl.Budget,
		Total:      productsTotal(products),
		Items:      products,
		Tags:       append([]string(nil), tmpl.Tags...),
		CreatedAt:  now,
		Generation: generation,
		Active:     true,
	}, nil
}

func pickCandidate(products []domain.Product, minRating float64, used map[int]bool) (domain.Product, bool) {
	for _, product := range products {
		if product.Rating < minRating {
			continue
		}
		if used != nil && used[product.ID] {
			continue
		}
		return product, true
	}
	return domain.Product{}, false
}

func fitBudget(items []candidate, budget int) ([]domain.Product, bool) {
	pool := append([]candidate(nil), items...)
	total := candidatesTotal(pool)

	for total > budget {
		if idx := mostExpensiveWithQuantity(pool); idx >= 0 {
			pool[idx].Product.Quantity--
			total -= pool[idx].Product.Price
			continue
		}
		if idx := lastOptional(pool); idx >= 0 {
			total -= candidateTotal(pool[idx])
			pool = append(pool[:idx], pool[idx+1:]...)
			continue
		}
		return nil, false
	}

	if len(pool) < 3 {
		return nil, false
	}

	target := budget * 7 / 10
	for total < target {
		if added := addMissingOptional(pool, items, budget-total); added != nil {
			pool = append(pool, *added)
			total += candidateTotal(*added)
			continue
		}
		idx := cheapestWithQuantityBelow3(pool)
		if idx < 0 {
			break
		}
		pool[idx].Product.Quantity++
		total += pool[idx].Product.Price
	}

	return candidatesToProducts(pool), true
}

func mostExpensiveWithQuantity(items []candidate) int {
	idx := -1
	best := 0
	for i, item := range items {
		if item.Product.Quantity > 1 && item.Product.Price > best {
			idx = i
			best = item.Product.Price
		}
	}
	return idx
}

func lastOptional(items []candidate) int {
	for i := len(items) - 1; i >= 0; i-- {
		if items[i].Optional {
			return i
		}
	}
	return -1
}

func addMissingOptional(pool, all []candidate, remaining int) *candidate {
	for _, item := range all {
		if !item.Optional || containsProduct(pool, item.Product.ID) {
			continue
		}
		if candidateTotal(item) <= remaining {
			copied := item
			return &copied
		}
	}
	return nil
}

func cheapestWithQuantityBelow3(items []candidate) int {
	idx := -1
	for i, item := range items {
		if item.Product.Quantity >= 3 {
			continue
		}
		if idx < 0 || item.Product.Price < items[idx].Product.Price {
			idx = i
		}
	}
	return idx
}

func containsProduct(items []candidate, id int) bool {
	for _, item := range items {
		if item.Product.ID == id {
			return true
		}
	}
	return false
}

func candidatesToProducts(items []candidate) []domain.Product {
	products := make([]domain.Product, 0, len(items))
	for _, item := range items {
		products = append(products, item.Product)
	}
	return products
}

func productsTotal(items []domain.Product) int {
	total := 0
	for _, item := range items {
		total += candidateTotal(candidate{Product: item})
	}
	return total
}

func candidatesTotal(items []candidate) int {
	total := 0
	for _, item := range items {
		total += candidateTotal(item)
	}
	return total
}

func candidateTotal(item candidate) int {
	return int(math.Round(item.Product.Quantity)) * item.Product.Price
}
