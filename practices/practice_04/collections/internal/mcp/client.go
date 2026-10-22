package mcp

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"golang.org/x/time/rate"

	"vkusvill-collections/internal/domain"
)

type Client interface {
	SearchProducts(ctx context.Context, query string, limit int, sort string) ([]domain.Product, error)
	CreateCartLink(ctx context.Context, items []domain.CartItem) (string, error)
	Close() error
}

type Remote struct {
	url     string
	token   string
	timeout time.Duration
	limiter *rate.Limiter

	mu      sync.Mutex
	client  *mcp.Client
	session *mcp.ClientSession
	closed  bool
}

func NewRemote(url, token string, timeout time.Duration) *Remote {
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	return &Remote{
		url:     url,
		token:   token,
		timeout: timeout,
		limiter: rate.NewLimiter(2, 4),
	}
}

func (r *Remote) SearchProducts(ctx context.Context, query string, limit int, sort string) ([]domain.Product, error) {
	if strings.TrimSpace(query) == "" {
		return nil, errors.New("query must not be empty")
	}
	if limit <= 0 || limit > 10 {
		limit = 10
	}
	if sort == "" {
		sort = "popularity"
	}

	text, err := r.callTool(ctx, "vkusvill_products_search", map[string]any{
		"q":     query,
		"limit": limit,
		"sort":  sort,
		"mode":  "short",
	})
	if err != nil {
		return nil, err
	}
	return parseSearch(text)
}

func (r *Remote) CreateCartLink(ctx context.Context, items []domain.CartItem) (string, error) {
	if len(items) == 0 {
		return "", errors.New("cart items must not be empty")
	}
	products := make([]map[string]any, 0, len(items))
	for _, item := range items {
		if item.ID <= 0 {
			return "", fmt.Errorf("invalid product id %d", item.ID)
		}
		if item.Quantity < 0.01 || item.Quantity > 40 {
			return "", fmt.Errorf("invalid quantity %v for product %d", item.Quantity, item.ID)
		}
		products = append(products, map[string]any{"id": item.ID, "q": item.Quantity})
	}

	text, err := r.callTool(ctx, "vkusvill_cart_link_create", map[string]any{
		"products": products,
	})
	if err != nil {
		return "", err
	}
	return parseCartLink(text)
}

func (r *Remote) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.closed = true
	if r.session == nil {
		return nil
	}
	err := r.session.Close()
	r.session = nil
	return err
}

func (r *Remote) callTool(ctx context.Context, name string, args map[string]any) (string, error) {
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if err := r.limiter.Wait(ctx); err != nil {
			return "", fmt.Errorf("%s: wait limiter: %w", name, err)
		}

		text, err := r.callOnce(ctx, name, args)
		if err == nil {
			return text, nil
		}
		lastErr = err
		r.resetSession()
		if !retryable(err) || attempt == 2 {
			break
		}
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(time.Duration(attempt+1) * time.Second):
		}
	}
	return "", fmt.Errorf("%s: %w", name, lastErr)
}

func (r *Remote) callOnce(ctx context.Context, name string, args map[string]any) (string, error) {
	session, err := r.getSession(ctx)
	if err != nil {
		return "", err
	}

	callCtx, cancel := context.WithTimeout(ctx, r.timeout)
	defer cancel()

	result, err := session.CallTool(callCtx, &mcp.CallToolParams{
		Name:      name,
		Arguments: args,
	})
	if err != nil {
		return "", err
	}

	var builder strings.Builder
	for _, content := range result.Content {
		if text, ok := content.(*mcp.TextContent); ok {
			if builder.Len() > 0 {
				builder.WriteString("\n")
			}
			builder.WriteString(text.Text)
		}
	}
	output := builder.String()
	if result.IsError {
		if output == "" {
			output = "tool returned an error"
		}
		return "", errors.New(output)
	}
	if output == "" {
		return "", errors.New("tool returned empty response")
	}
	return output, nil
}

func (r *Remote) getSession(ctx context.Context) (*mcp.ClientSession, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.closed {
		return nil, errors.New("client is closed")
	}
	if r.session != nil {
		return r.session, nil
	}
	if r.client == nil {
		r.client = mcp.NewClient(&mcp.Implementation{
			Name:    "vkusvill-collections",
			Version: "0.1.0",
		}, nil)
	}

	httpClient := &http.Client{Timeout: r.timeout}
	if r.token != "" {
		httpClient.Transport = bearerTransport{base: http.DefaultTransport, token: r.token}
	}

	transport := &mcp.StreamableClientTransport{
		Endpoint:             r.url,
		HTTPClient:           httpClient,
		DisableStandaloneSSE: true,
		MaxRetries:           3,
	}
	connectCtx, cancel := context.WithTimeout(ctx, r.timeout)
	defer cancel()

	session, err := r.client.Connect(connectCtx, transport, nil)
	if err != nil {
		return nil, fmt.Errorf("connect to MCP: %w", err)
	}
	r.session = session
	return session, nil
}

func (r *Remote) resetSession() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.session != nil {
		_ = r.session.Close()
		r.session = nil
	}
}

func retryable(err error) bool {
	message := strings.ToLower(err.Error())
	for _, marker := range []string{"429", "rate limit", "too many requests", "timeout", "deadline exceeded", "connection reset", "eof", "fetch failed"} {
		if strings.Contains(message, marker) {
			return true
		}
	}
	return false
}

type bearerTransport struct {
	base  http.RoundTripper
	token string
}

func (t bearerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	clone := req.Clone(req.Context())
	clone.Header.Set("Authorization", "Bearer "+t.token)
	return t.base.RoundTrip(clone)
}
