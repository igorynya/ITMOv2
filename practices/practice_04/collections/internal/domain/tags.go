package domain

import (
	"sort"
	"strings"
	"unicode/utf8"
)

const MaxTagLength = 64

func TrimTag(raw string) string {
	return strings.TrimSpace(raw)
}

func AvailableTags(cols []Collection) []string {
	canonical := make([]string, 0)
	for _, col := range cols {
		for _, raw := range col.Tags {
			tag := strings.TrimSpace(raw)
			if tag == "" || utf8.RuneCountInString(tag) > MaxTagLength {
				continue
			}
			merged := false
			for i, existing := range canonical {
				if strings.EqualFold(existing, tag) {
					merged = true
					if tag < existing {
						canonical[i] = tag
					}
					break
				}
			}
			if !merged {
				canonical = append(canonical, tag)
			}
		}
	}
	sort.Strings(canonical)
	return canonical
}

func ResolveTag(available []string, requested string) (string, bool) {
	for _, tag := range available {
		if strings.EqualFold(tag, requested) {
			return tag, true
		}
	}
	return "", false
}

func HasTag(col Collection, tag string) bool {
	for _, raw := range col.Tags {
		value := strings.TrimSpace(raw)
		if value == "" {
			continue
		}
		if strings.EqualFold(value, tag) {
			return true
		}
	}
	return false
}
