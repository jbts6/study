package runner

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// Status is the only execution status exposed by the API layer.
type Status string

const (
	StatusPassed            Status = "passed"
	StatusCompileError      Status = "compile_error"
	StatusTestFailed        Status = "test_failed"
	StatusTimeout           Status = "timeout"
	StatusRunnerUnavailable Status = "runner_unavailable"
	StatusInvalidRequest    Status = "invalid_request"
)

const (
	TestPassed = "passed"
	TestFailed = "failed"
)

const (
	DefaultImage        = "study-go-runner:1.25.1"
	DefaultMaxCodeBytes = 64 * 1024
	DefaultMaxOutput    = 32 * 1024
	DefaultTimeout      = 3 * time.Second
)

// Request contains only server-selected execution inputs and user code.
type Request struct {
	Code       string
	HiddenTest string
	TestLabels map[string]string
}

// Result is safe for the HTTP layer after runner-specific paths are removed.
type Result struct {
	Status      Status       `json:"status"`
	Stdout      string       `json:"stdout"`
	Stderr      string       `json:"stderr"`
	Diagnostics []Diagnostic `json:"diagnostics"`
	Tests       []TestResult `json:"tests"`
}

type Diagnostic struct {
	Line    int    `json:"line,omitempty"`
	Column  int    `json:"column,omitempty"`
	Message string `json:"message"`
}

type TestResult struct {
	Name    string `json:"name"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

type Limits struct {
	MaxCodeBytes   int
	MaxOutputBytes int
	Timeout        time.Duration
	CPUs           string
	Memory         string
	PidsLimit      int
	Tmpfs          string
}

func DefaultLimits() Limits {
	return Limits{
		MaxCodeBytes:   DefaultMaxCodeBytes,
		MaxOutputBytes: DefaultMaxOutput,
		Timeout:        DefaultTimeout,
		CPUs:           "0.5",
		Memory:         "128m",
		PidsLimit:      64,
		Tmpfs:          "/tmp:rw,noexec,nosuid,size=16m",
	}
}

type Runner interface {
	Run(ctx context.Context, request Request) Result
}

type validationError struct {
	message string
}

func (e *validationError) Error() string { return e.message }

func ValidateCode(code string, maxBytes int) error {
	if strings.TrimSpace(code) == "" {
		return &validationError{message: "代码不能为空"}
	}
	if strings.ContainsRune(code, '\x00') {
		return &validationError{message: "代码包含不支持的控制字符"}
	}
	if maxBytes <= 0 {
		maxBytes = DefaultMaxCodeBytes
	}
	if len([]byte(code)) > maxBytes {
		return &validationError{message: fmt.Sprintf("代码不能超过 %d 字节", maxBytes)}
	}
	return nil
}
