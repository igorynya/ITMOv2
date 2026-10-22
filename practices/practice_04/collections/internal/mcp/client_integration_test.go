//go:build integration

package mcp

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestIntegrationSearch(t *testing.T) {
	url := os.Getenv("VV_MCP_URL")
	if url == "" {
		url = "https://mcp.vkusvill.ru/mcp"
	}
	client := NewRemote(url, os.Getenv("VV_ACCESS_TOKEN"), 30*time.Second)
	defer client.Close()

	items, err := client.SearchProducts(context.Background(), "круассан", 3, "popularity")
	if err != nil {
		t.Fatal(err)
	}
	if len(items) == 0 {
		t.Fatal("no products returned")
	}
	t.Logf("found %d products, first: %s (%d RUB)", len(items), items[0].Name, items[0].Price)
}
