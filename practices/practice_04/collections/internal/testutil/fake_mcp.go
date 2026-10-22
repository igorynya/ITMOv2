package testutil

import (
	"context"
	"fmt"
	"hash/fnv"
	"sync"

	"vkusvill-collections/internal/domain"
)

type FakeMCP struct {
	mu        sync.Mutex
	Results   map[string][]domain.Product
	Errors    map[string]error
	CartURL   string
	Err       error
	Searches  int
	CartCalls int
}

func NewFakeMCP(results map[string][]domain.Product) *FakeMCP {
	if results == nil {
		results = map[string][]domain.Product{}
	}
	return &FakeMCP{Results: results}
}

func (f *FakeMCP) SearchProducts(_ context.Context, query string, _ int, _ string) ([]domain.Product, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.Searches++
	if f.Err != nil {
		return nil, f.Err
	}
	if err := f.Errors[query]; err != nil {
		return nil, err
	}

	items, ok := f.Results[query]
	if !ok {
		hash := fnv.New32a()
		_, _ = hash.Write([]byte(query))
		items = []domain.Product{{
			ID:       int(hash.Sum32()%100000) + 1,
			Name:     "Товар: " + query,
			Price:    100,
			Unit:     "шт",
			Rating:   4.8,
			Quantity: 1,
		}}
	}
	copied := make([]domain.Product, len(items))
	copy(copied, items)
	return copied, nil
}

func (f *FakeMCP) CreateCartLink(_ context.Context, _ []domain.CartItem) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.CartCalls++
	if f.Err != nil {
		return "", f.Err
	}
	if f.CartURL != "" {
		return f.CartURL, nil
	}
	return fmt.Sprintf("https://vkusvill.ru/mobile?basket&share=%d", f.CartCalls), nil
}

func (f *FakeMCP) Close() error { return nil }
