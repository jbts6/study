package main

import "testing"

func TestApplyTextMiddleware(t *testing.T) {
	base := func(input string) string { return "[" + input + "]" }
	handler := applyTextMiddleware(base, withPrefix("first:"), withPrefix("second:"))
	if got := handler("go"); got != "first:second:[go]" {
		t.Fatalf("handler() = %q, want first:second:[go]", got)
	}
}
