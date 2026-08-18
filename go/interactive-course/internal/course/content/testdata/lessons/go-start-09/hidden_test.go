package main

import "testing"

func TestParsePositive(t *testing.T) {
	value, err := parsePositive(" 12 ")
	if err != nil || value != 12 {
		t.Fatalf("parsePositive() = %d, %v; want 12, nil", value, err)
	}
}

func TestParsePositiveErrors(t *testing.T) {
	for _, input := range []string{"nope", "0", "-2"} {
		if _, err := parsePositive(input); err == nil {
			t.Fatalf("parsePositive(%q) error = nil", input)
		}
	}
}
