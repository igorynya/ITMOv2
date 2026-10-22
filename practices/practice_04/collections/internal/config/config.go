package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

const (
	defaultPort          = "8080"
	defaultDBPath        = "./data/collections.db"
	defaultMCPURL        = "https://mcp.vkusvill.ru/mcp"
	defaultPageSize      = 12
	defaultCartLinkTTL   = 24 * time.Hour
	defaultHTTPTimeout   = 30 * time.Second
	defaultLogLevel      = "info"
	minCollectionsPerPag = 10
	maxCollectionsPerPag = 15
)

type Config struct {
	Addr               string
	DBPath             string
	MCPURL             string
	MCPToken           string
	CollectionsPerPage int
	CartLinkTTL        time.Duration
	HTTPTimeout        time.Duration
	LogLevel           string
}

func Load() (Config, error) {
	port := env("PORT", defaultPort)
	if _, err := strconv.Atoi(port); err != nil {
		return Config{}, fmt.Errorf("PORT must be a number: %w", err)
	}

	pageSize, err := envInt("COLLECTIONS_PER_PAGE", defaultPageSize, minCollectionsPerPag, maxCollectionsPerPag)
	if err != nil {
		return Config{}, err
	}

	cartTTL, err := envDuration("CART_LINK_TTL", defaultCartLinkTTL)
	if err != nil {
		return Config{}, err
	}

	return Config{
		Addr:               ":" + port,
		DBPath:             env("DB_PATH", defaultDBPath),
		MCPURL:             env("VV_MCP_URL", defaultMCPURL),
		MCPToken:           os.Getenv("VV_ACCESS_TOKEN"),
		CollectionsPerPage: pageSize,
		CartLinkTTL:        cartTTL,
		HTTPTimeout:        defaultHTTPTimeout,
		LogLevel:           env("LOG_LEVEL", defaultLogLevel),
	}, nil
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback, minValue, maxValue int) (int, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("%s must be a number: %w", key, err)
	}
	if value < minValue || value > maxValue {
		return 0, fmt.Errorf("%s must be between %d and %d", key, minValue, maxValue)
	}
	return value, nil
}

func envDuration(key string, fallback time.Duration) (time.Duration, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	value, err := time.ParseDuration(raw)
	if err != nil {
		return 0, fmt.Errorf("%s must be a duration: %w", key, err)
	}
	if value <= 0 {
		return 0, fmt.Errorf("%s must be positive", key)
	}
	return value, nil
}
