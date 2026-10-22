package domain

import "time"

type Product struct {
	ID       int     `json:"id"`
	Name     string  `json:"name"`
	Price    int     `json:"price"`
	Unit     string  `json:"unit"`
	Rating   float64 `json:"rating"`
	Quantity float64 `json:"quantity"`
	URL      string  `json:"url"`
}

type CartItem struct {
	ID       int     `json:"id"`
	Quantity float64 `json:"q"`
}

type Collection struct {
	ID         string    `json:"id"`
	Slug       string    `json:"slug"`
	Title      string    `json:"title"`
	Subtitle   string    `json:"subtitle"`
	Template   string    `json:"template"`
	Budget     int       `json:"budget"`
	Total      int       `json:"total"`
	Items      []Product `json:"items"`
	Tags       []string  `json:"tags"`
	CartURL    string    `json:"cart_url,omitempty"`
	CartSetAt  time.Time `json:"-"`
	CreatedAt  time.Time `json:"created_at"`
	Generation int64     `json:"generation"`
	Active     bool      `json:"-"`
}

func (c Collection) CartItems() []CartItem {
	items := make([]CartItem, 0, len(c.Items))
	for _, item := range c.Items {
		items = append(items, CartItem{ID: item.ID, Quantity: item.Quantity})
	}
	return items
}
