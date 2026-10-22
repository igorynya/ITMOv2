package config

import (
	"strings"
	"testing"
	"time"
)

func TestLoadDefaults(t *testing.T) {
	for _, key := range []string{
		"PORT", "DB_PATH", "VV_MCP_URL", "VV_ACCESS_TOKEN",
		"COLLECTIONS_PER_PAGE", "CART_LINK_TTL", "LOG_LEVEL",
	} {
		t.Setenv(key, "")
	}

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Addr != ":8080" {
		t.Fatalf("Addr = %q", cfg.Addr)
	}
	if cfg.DBPath != "./data/collections.db" {
		t.Fatalf("DBPath = %q", cfg.DBPath)
	}
	if cfg.MCPURL != "https://mcp.vkusvill.ru/mcp" {
		t.Fatalf("MCPURL = %q", cfg.MCPURL)
	}
	if cfg.CollectionsPerPage != 12 {
		t.Fatalf("CollectionsPerPage = %d", cfg.CollectionsPerPage)
	}
	if cfg.CartLinkTTL != 24*time.Hour {
		t.Fatalf("CartLinkTTL = %v", cfg.CartLinkTTL)
	}
	if cfg.LogLevel != "info" {
		t.Fatalf("LogLevel = %q", cfg.LogLevel)
	}
}

func TestLoadRejectsBadPort(t *testing.T) {
	t.Setenv("PORT", "abc")
	if _, err := Load(); err == nil {
		t.Fatal("expected error")
	}
}

func TestLoadRejectsBadPageSize(t *testing.T) {
	t.Setenv("COLLECTIONS_PER_PAGE", "42")
	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "between 10 and 15") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadRejectsBadDuration(t *testing.T) {
	t.Setenv("CART_LINK_TTL", "soon")
	if _, err := Load(); err == nil {
		t.Fatal("expected error")
	}
}
