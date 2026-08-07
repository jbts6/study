package runner

import (
	"context"
	"errors"
	"testing"
)

func TestClassifyDockerRunError(t *testing.T) {
	tests := []struct {
		name   string
		err    error
		stderr string
		want   Status
	}{
		{name: "deadline", err: context.DeadlineExceeded, want: StatusTimeout},
		{name: "daemon unavailable", err: errors.New("exit status 1"), stderr: "Cannot connect to the Docker daemon", want: StatusRunnerUnavailable},
		{name: "docker api unavailable", err: errors.New("exit status 1"), stderr: "failed to connect to the Docker API at npipe:////./pipe/dockerDesktopLinuxEngine", want: StatusRunnerUnavailable},
		{name: "test failure", err: errors.New("exit status 1"), stderr: "FAIL\n", want: StatusTestFailed},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := classifyRunError(tt.err, tt.stderr, context.Background()); got != tt.want {
				t.Fatalf("classifyRunError() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestSanitizeRunnerMessageDoesNotExposeWorkspace(t *testing.T) {
	message := sanitizeRunnerMessage(`open C:\Users\student\AppData\Local\Temp\go-course-run-123\main.go: permission denied`, `C:\Users\student\AppData\Local\Temp\go-course-run-123`)
	if message == "" || containsAny(message, []string{"C:\\Users\\student", "go-course-run-123"}) {
		t.Fatalf("sanitizeRunnerMessage() leaked host path: %q", message)
	}
}

func containsAny(value string, needles []string) bool {
	for _, needle := range needles {
		if value == needle || len(needle) > 0 && stringsContains(value, needle) {
			return true
		}
	}
	return false
}

func stringsContains(value, needle string) bool {
	for index := 0; index+len(needle) <= len(value); index++ {
		if value[index:index+len(needle)] == needle {
			return true
		}
	}
	return false
}
