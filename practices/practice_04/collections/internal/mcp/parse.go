package mcp

import (
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"math"
	"strings"

	"vkusvill-collections/internal/domain"
)

type searchResponse struct {
	OK    bool   `json:"ok"`
	Error string `json:"error"`
	Data  struct {
		Items []struct {
			ID    int    `json:"id"`
			Name  string `json:"name"`
			Price struct {
				Current float64 `json:"current"`
			} `json:"price"`
			Unit   string `json:"unit"`
			Rating struct {
				Average float64 `json:"average"`
			} `json:"rating"`
			URL string `json:"url"`
		} `json:"items"`
	} `json:"data"`
}

type cartResponse struct {
	OK    bool   `json:"ok"`
	Error string `json:"error"`
	Data  struct {
		Link string `json:"link"`
	} `json:"data"`
}

func parseSearch(text string) ([]domain.Product, error) {
	var payload searchResponse
	if err := json.Unmarshal([]byte(strings.TrimSpace(text)), &payload); err != nil {
		return nil, fmt.Errorf("decode search response: %w", err)
	}
	if !payload.OK {
		return nil, fmt.Errorf("search failed: %s", payload.Error)
	}
	items := make([]domain.Product, 0, len(payload.Data.Items))
	for _, item := range payload.Data.Items {
		if item.ID <= 0 {
			continue
		}
		items = append(items, domain.Product{
			ID:       item.ID,
			Name:     cleanName(item.Name),
			Price:    int(math.Round(item.Price.Current)),
			Unit:     item.Unit,
			Rating:   math.Round(item.Rating.Average*10) / 10,
			Quantity: 1,
			URL:      item.URL,
		})
	}
	if len(items) == 0 {
		return nil, errors.New("search returned no products")
	}
	return items, nil
}

func parseCartLink(text string) (string, error) {
	var payload cartResponse
	if err := json.Unmarshal([]byte(strings.TrimSpace(text)), &payload); err != nil {
		return "", fmt.Errorf("decode cart response: %w", err)
	}
	if !payload.OK {
		return "", fmt.Errorf("cart link failed: %s", payload.Error)
	}
	link := strings.TrimSpace(payload.Data.Link)
	if link == "" {
		return "", errors.New("cart link is empty")
	}
	if !strings.HasPrefix(link, "https://vkusvill.ru/") {
		return "", fmt.Errorf("unexpected cart link host: %s", link)
	}
	return link, nil
}

func cleanName(name string) string {
	name = strings.ReplaceAll(name, "&nbsp;", " ")
	name = html.UnescapeString(name)
	return strings.TrimSpace(name)
}
