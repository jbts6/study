package runner

import (
	"context"
	"strings"
	"testing"
)

const localRunnerHiddenTest = `package main

import "testing"

func TestLesson(t *testing.T) {}
`

func TestLocalRunnerRunsHiddenTest(t *testing.T) {
	result := NewLocalRunner().Run(context.Background(), Request{
		Code:       "package main\nfunc main() {}\n",
		HiddenTest: localRunnerHiddenTest,
		TestLabels: map[string]string{"TestLesson": "本地测试"},
	})

	if result.Status != StatusPassed {
		t.Fatalf("local runner status = %q, want %q; stderr=%s", result.Status, StatusPassed, result.Stderr)
	}
	if len(result.Tests) != 1 || result.Tests[0].Name != "本地测试" || result.Tests[0].Status != TestPassed {
		t.Fatalf("local runner tests = %#v, want one labeled passing test", result.Tests)
	}
}

func TestLocalRunnerParsesCompileError(t *testing.T) {
	result := NewLocalRunner().Run(context.Background(), Request{
		Code:       "package main\nfunc main() { missing() }\n",
		HiddenTest: localRunnerHiddenTest,
	})

	if result.Status != StatusCompileError || len(result.Diagnostics) == 0 {
		t.Fatalf("local compile result = %#v, want compile_error with diagnostics", result)
	}
}

func TestLocalRunnerParsesTestFailure(t *testing.T) {
	result := NewLocalRunner().Run(context.Background(), Request{
		Code: "package main\nfunc main() {}\n",
		HiddenTest: `package main

import "testing"

func TestLesson(t *testing.T) {
	t.Fatal("expected failure")
}
`,
	})

	if result.Status != StatusTestFailed || len(result.Tests) != 1 || result.Tests[0].Status != TestFailed || !strings.Contains(result.Tests[0].Message, "expected failure") {
		t.Fatalf("local failure result = %#v, want labeled test failure", result)
	}
}

func TestLocalRunnerReturnsUnavailableWithoutGoBinary(t *testing.T) {
	runner := NewLocalRunnerWithConfig(LocalConfig{GoBinary: "go-course-go-does-not-exist"})
	result := runner.Run(context.Background(), Request{
		Code:       "package main\nfunc main() {}\n",
		HiddenTest: localRunnerHiddenTest,
	})

	if result.Status != StatusRunnerUnavailable {
		t.Fatalf("local unavailable status = %q, want %q", result.Status, StatusRunnerUnavailable)
	}
}
