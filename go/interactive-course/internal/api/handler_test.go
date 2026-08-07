package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"study.local/go-interactive-course/internal/course"
	"study.local/go-interactive-course/internal/runner"
)

type fakeRunner struct {
	called  bool
	request runner.Request
	result  runner.Result
}

func (f *fakeRunner) Run(_ context.Context, request runner.Request) runner.Result {
	f.called = true
	f.request = request
	return f.result
}

func TestGetCourseReturnsPublicLessonsWithoutHiddenTests(t *testing.T) {
	catalog := mustCatalog(t)
	handler := NewHandler(catalog, &fakeRunner{})
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/course", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("GET /api/course status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if contentType := recorder.Header().Get("Content-Type"); contentType != "application/json; charset=utf-8" {
		t.Fatalf("Content-Type = %q, want JSON content type", contentType)
	}
	var public course.PublicCourse
	if err := json.Unmarshal(recorder.Body.Bytes(), &public); err != nil {
		t.Fatalf("decode course response: %v", err)
	}
	if len(public.Lessons) != 4 || public.Lessons[0].ID != "go-start-01" {
		t.Fatalf("course lessons = %#v, want four ordered lessons", public.Lessons)
	}
	if strings.Contains(recorder.Body.String(), "captureProgramOutput") || strings.Contains(recorder.Body.String(), "hidden_test.go") {
		t.Fatalf("course response contains server-only test source: %s", recorder.Body.String())
	}
}

func TestPostExecuteUsesServerLessonTest(t *testing.T) {
	catalog := mustCatalog(t)
	fake := &fakeRunner{result: runner.Result{
		Status: runner.StatusPassed,
		Stdout: "Hello, Go!\n",
		Tests:  []runner.TestResult{{Name: "输出 Hello, Go!", Status: runner.TestPassed}},
	}}
	handler := NewHandler(catalog, fake)
	body := `{"lessonId":"go-start-01","code":"package main\nfunc main() {}\n"}`
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/execute", strings.NewReader(body)))

	if recorder.Code != http.StatusOK || statusFromBody(t, recorder) != runner.StatusPassed {
		t.Fatalf("execute response = %d/%s, want 200/passed", recorder.Code, statusFromBody(t, recorder))
	}
	if !fake.called || !strings.Contains(fake.request.HiddenTest, "TestHelloGoOutput") {
		t.Fatalf("runner request did not receive server hidden test: %#v", fake.request)
	}
	if strings.Contains(fake.request.HiddenTest, "package main\\nfunc main") {
		t.Fatalf("runner hidden test was replaced by client code")
	}
}

func TestPostExecuteRejectsInvalidRequests(t *testing.T) {
	catalog := mustCatalog(t)
	tests := []struct {
		name string
		body string
	}{
		{name: "unknown field", body: `{"lessonId":"go-start-01","code":"package main","extra":true}`},
		{name: "invalid json", body: `{"lessonId":`},
		{name: "empty lesson", body: `{"lessonId":"","code":"package main"}`},
		{name: "unknown lesson", body: `{"lessonId":"missing","code":"package main"}`},
		{name: "empty code", body: `{"lessonId":"go-start-01","code":"  "}`},
		{name: "code too large", body: mustRequestBody("go-start-01", strings.Repeat("x", runner.DefaultMaxCodeBytes+1))},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeRunner{}
			recorder := httptest.NewRecorder()
			NewHandler(catalog, fake).ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/execute", strings.NewReader(tt.body)))
			if recorder.Code != http.StatusBadRequest || statusFromBody(t, recorder) != runner.StatusInvalidRequest {
				t.Fatalf("response = %d/%s, want 400/invalid_request", recorder.Code, statusFromBody(t, recorder))
			}
			if fake.called {
				t.Fatalf("runner called for invalid request")
			}
		})
	}
}

func TestHandlersRejectUnsupportedMethods(t *testing.T) {
	catalog := mustCatalog(t)
	recorder := httptest.NewRecorder()
	NewHandler(catalog, &fakeRunner{}).ServeHTTP(recorder, httptest.NewRequest(http.MethodPut, "/api/course", nil))
	if recorder.Code != http.StatusMethodNotAllowed || statusFromBody(t, recorder) != runner.StatusInvalidRequest {
		t.Fatalf("method response = %d/%s, want 405/invalid_request", recorder.Code, statusFromBody(t, recorder))
	}
}

func TestPostExecuteMapsRunnerStatuses(t *testing.T) {
	catalog := mustCatalog(t)
	tests := []struct {
		status   runner.Status
		wantHTTP int
	}{
		{status: runner.StatusCompileError, wantHTTP: http.StatusOK},
		{status: runner.StatusTestFailed, wantHTTP: http.StatusOK},
		{status: runner.StatusTimeout, wantHTTP: http.StatusOK},
		{status: runner.StatusRunnerUnavailable, wantHTTP: http.StatusServiceUnavailable},
	}
	for _, tt := range tests {
		t.Run(string(tt.status), func(t *testing.T) {
			fake := &fakeRunner{result: runner.Result{Status: tt.status}}
			recorder := httptest.NewRecorder()
			NewHandler(catalog, fake).ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/execute", bytes.NewBufferString(mustRequestBody("go-start-01", "package main"))))
			if recorder.Code != tt.wantHTTP || statusFromBody(t, recorder) != tt.status {
				t.Fatalf("response = %d/%s, want %d/%s", recorder.Code, statusFromBody(t, recorder), tt.wantHTTP, tt.status)
			}
		})
	}
}

func mustCatalog(t *testing.T) *course.Catalog {
	t.Helper()
	catalog, err := course.LoadCatalog()
	if err != nil {
		t.Fatalf("LoadCatalog() error = %v", err)
	}
	return catalog
}

func mustRequestBody(lessonID, code string) string {
	data, err := json.Marshal(struct {
		LessonID string `json:"lessonId"`
		Code     string `json:"code"`
	}{LessonID: lessonID, Code: code})
	if err != nil {
		panic(err)
	}
	return string(data)
}

func statusFromBody(t *testing.T, recorder *httptest.ResponseRecorder) runner.Status {
	t.Helper()
	var payload struct {
		Status runner.Status `json:"status"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v; body=%s", err, recorder.Body.String())
	}
	return payload.Status
}
