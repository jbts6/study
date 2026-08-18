package main

import "testing"

func TestAuthMiddleware(t *testing.T) {
	called := false
	handler := chain(func(Request) string { called = true; return "ok" }, authMiddleware)
	got := handler(Request{Headers: map[string]string{"X-Token": "study"}})
	if got != "ok" || !called {
		t.Fatalf("authorized result = %q, called = %v", got, called)
	}
}

func TestAuthMiddlewareRejectsRequest(t *testing.T) {
	called := false
	handler := chain(func(Request) string { called = true; return "ok" }, authMiddleware)
	if got := handler(Request{}); got != "unauthorized" || called {
		t.Fatalf("unauthorized result = %q, called = %v", got, called)
	}
}
