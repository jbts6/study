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

func TestNewRunnerSupportsLocalModeByDefault(t *testing.T) {
	selected, err := newRunner("local", runner.DefaultImage)
	if err != nil {
		t.Fatalf("newRunner(local) error = %v", err)
	}
	if _, ok := selected.(*runner.LocalRunner); !ok {
		t.Fatalf("newRunner(local) = %T, want *runner.LocalRunner", selected)
	}
}

func TestNewRunnerSupportsOptionalDockerMode(t *testing.T) {
	selected, err := newRunner("docker", runner.DefaultImage)
	if err != nil {
		t.Fatalf("newRunner(docker) error = %v", err)
	}
	if _, ok := selected.(*runner.DockerRunner); !ok {
		t.Fatalf("newRunner(docker) = %T, want *runner.DockerRunner", selected)
	}
}

func TestNewRunnerRejectsUnknownMode(t *testing.T) {
	if _, err := newRunner("unknown", runner.DefaultImage); err == nil {
		t.Fatal("newRunner(unknown) error = nil, want an error")
	}
}
