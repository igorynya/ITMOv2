package mcp

import "testing"

func TestParseSearch(t *testing.T) {
	items, err := parseSearch(`{"ok":true,"data":{"items":[{"id":22300,"name":"Круассан&nbsp;на масле","price":{"current":110,"currency":"RUB"},"unit":"шт","rating":{"average":4.9000000000000004},"url":"https://vkusvill.ru/goods/1/"}]}}`)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("got %d items", len(items))
	}
	item := items[0]
	if item.ID != 22300 || item.Price != 110 {
		t.Fatalf("bad item: %+v", item)
	}
	if item.Name != "Круассан на масле" {
		t.Fatalf("entities not decoded: %q", item.Name)
	}
	if item.Rating != 4.9 {
		t.Fatalf("rating = %v", item.Rating)
	}
}

func TestParseSearchErrorPayload(t *testing.T) {
	if _, err := parseSearch(`{"ok":false,"error":"boom"}`); err == nil {
		t.Fatal("expected error")
	}
	if _, err := parseSearch(`{"ok":true,"data":{"items":[]}}`); err == nil {
		t.Fatal("expected error for empty items")
	}
}

func TestParseSearchBadJSON(t *testing.T) {
	if _, err := parseSearch(`not json`); err == nil {
		t.Fatal("expected error")
	}
}

func TestParseCartLink(t *testing.T) {
	link, err := parseCartLink(`{"ok":true,"data":{"link":"https://vkusvill.ru/mobile?basket&share=1"}}`)
	if err != nil {
		t.Fatal(err)
	}
	if link != "https://vkusvill.ru/mobile?basket&share=1" {
		t.Fatalf("link = %q", link)
	}
}

func TestParseCartLinkRejectsForeignHost(t *testing.T) {
	if _, err := parseCartLink(`{"ok":true,"data":{"link":"https://evil.test/cart"}}`); err == nil {
		t.Fatal("expected error")
	}
	if _, err := parseCartLink(`{"ok":true,"data":{"link":""}}`); err == nil {
		t.Fatal("expected error")
	}
}
