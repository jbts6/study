package api

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"study.local/go-interactive-course/internal/course"
	"study.local/go-interactive-course/internal/runner"
)

const maxRequestBytes = runner.DefaultMaxCodeBytes + 4*1024

type executeRequest struct {
	LessonID string `json:"lessonId"`
	Code     string `json:"code"`
}

type handler struct {
	catalog *course.Catalog
	runner  runner.Runner
}

func NewHandler(catalog *course.Catalog, executionRunner runner.Runner) http.Handler {
	h := &handler{catalog: catalog, runner: executionRunner}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/course", h.handleCourse)
	mux.HandleFunc("/api/execute", h.handleExecute)
	return mux
}

func (h *handler) handleCourse(response http.ResponseWriter, request *http.Request) {
	if request.URL.Path != "/api/course" {
		writeError(response, http.StatusNotFound, "课程接口不存在")
		return
	}
	if request.Method != http.MethodGet {
		writeError(response, http.StatusMethodNotAllowed, "只支持 GET 请求")
		return
	}
	if h.catalog == nil {
		writeError(response, http.StatusInternalServerError, "课程服务未准备好")
		return
	}
	writeJSON(response, http.StatusOK, h.catalog.PublicCourse())
}

func (h *handler) handleExecute(response http.ResponseWriter, request *http.Request) {
	if request.URL.Path != "/api/execute" {
		writeError(response, http.StatusNotFound, "执行接口不存在")
		return
	}
	if request.Method != http.MethodPost {
		writeError(response, http.StatusMethodNotAllowed, "只支持 POST 请求")
		return
	}
	if h.catalog == nil || h.runner == nil {
		writeError(response, http.StatusInternalServerError, "执行服务未准备好")
		return
	}

	var payload executeRequest
	decoder := json.NewDecoder(http.MaxBytesReader(response, request.Body, maxRequestBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&payload); err != nil {
		writeError(response, http.StatusBadRequest, "请求 JSON 无效或超过大小限制")
		return
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); err != io.EOF {
		writeError(response, http.StatusBadRequest, "请求只能包含一个 JSON 对象")
		return
	}

	payload.LessonID = strings.TrimSpace(payload.LessonID)
	lesson, ok := h.catalog.Lesson(payload.LessonID)
	if !ok {
		writeError(response, http.StatusBadRequest, "课程小节不存在")
		return
	}
	if err := runner.ValidateCode(payload.Code, runner.DefaultMaxCodeBytes); err != nil {
		writeError(response, http.StatusBadRequest, err.Error())
		return
	}

	labels := make(map[string]string, len(lesson.Tests))
	for _, test := range lesson.Tests {
		labels[test.ID] = test.Label
	}
	result := h.runner.Run(request.Context(), runner.Request{
		Code:       payload.Code,
		HiddenTest: lesson.HiddenTest,
		TestLabels: labels,
	})
	result = normalizeResult(result)
	writeJSON(response, responseStatus(result.Status), result)
}

func responseStatus(status runner.Status) int {
	switch status {
	case runner.StatusPassed, runner.StatusCompileError, runner.StatusTestFailed, runner.StatusTimeout:
		return http.StatusOK
	case runner.StatusInvalidRequest:
		return http.StatusBadRequest
	case runner.StatusRunnerUnavailable:
		return http.StatusServiceUnavailable
	default:
		return http.StatusInternalServerError
	}
}

func normalizeResult(result runner.Result) runner.Result {
	if result.Diagnostics == nil {
		result.Diagnostics = []runner.Diagnostic{}
	}
	if result.Tests == nil {
		result.Tests = []runner.TestResult{}
	}
	return result
}

func writeError(response http.ResponseWriter, status int, message string) {
	executionStatus := runner.StatusInvalidRequest
	if status >= http.StatusInternalServerError {
		executionStatus = runner.StatusRunnerUnavailable
	}
	writeJSON(response, status, normalizeResult(runner.Result{
		Status: executionStatus,
		Stderr: message,
	}))
}

func writeJSON(response http.ResponseWriter, status int, payload any) {
	response.Header().Set("Content-Type", "application/json; charset=utf-8")
	response.WriteHeader(status)
	_ = json.NewEncoder(response).Encode(payload)
}
