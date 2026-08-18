package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestStatusHandler(t *testing.T) {
	handler := newStatusHandler()
	for _, test := range []struct {
		method string
		path   string
		status int
		body   string
	}{
		{method: http.MethodGet, path: "/health", status: http.StatusOK, body: "ok"},
		{method: http.MethodPost, path: "/health", status: http.StatusMethodNotAllowed},
		{method: http.MethodGet, path: "/missing", status: http.StatusNotFound},
	} {
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, httptest.NewRequest(test.method, test.path, nil))
		if recorder.Code != test.status {
			t.Fatalf("%s %s status = %d, want %d", test.method, test.path, recorder.Code, test.status)
		}
		if test.body != "" && strings.TrimSpace(recorder.Body.String()) != test.body {
			t.Fatalf("%s %s body = %q, want %q", test.method, test.path, recorder.Body.String(), test.body)
		}
	}
}
