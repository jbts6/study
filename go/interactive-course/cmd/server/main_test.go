package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"study.local/go-interactive-course/internal/runner"
)

func TestNewHandlerLoadsEmbeddedCourse(t *testing.T) {
	handler, err := newHandler(runner.DefaultImage)
	if err != nil {
		t.Fatalf("newHandler() error = %v", err)
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/course", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("GET /api/course status = %d, want %d", recorder.Code, http.StatusOK)
	}
}
