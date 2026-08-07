package runner

import (
	"context"
	"strings"
	"testing"
)

func TestValidateCodeRejectsInvalidSubmissions(t *testing.T) {
	limits := DefaultLimits()
	tests := []struct {
		name string
		code string
	}{
		{name: "empty", code: ""},
		{name: "nul byte", code: "package main\x00"},
		{name: "too large", code: strings.Repeat("x", limits.MaxCodeBytes+1)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := ValidateCode(tt.code, limits.MaxCodeBytes); err == nil {
				t.Fatalf("ValidateCode() error = nil, want validation error")
			}
		})
	}
}

func TestBuildDockerArgsEnforcesSandbox(t *testing.T) {
	args := buildDockerArgs(`C:\temp\go-course-run`, DefaultImage, DefaultLimits())
	required := []string{
		"run", "--rm", "--network=none", "--read-only", "--user", "10001:10001",
		"--cpus=0.5", "--memory=128m", "--pids-limit=64", "--cap-drop=ALL",
		"--security-opt=no-new-privileges", "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
		"--tmpfs", "/run/go-tmp:rw,nosuid,size=32m", "--env", "GOTMPDIR=/run/go-tmp",
		"--workdir", "/workspace", DefaultImage, "go", "test", "-json", "-v", "-count=1", "./...",
	}
	for _, want := range required {
		if !containsArg(args, want) {
			t.Errorf("docker args missing %q: %#v", want, args)
		}
	}
	if containsArg(args, "go.exe") || containsArg(args, "go run") {
		t.Fatalf("docker args contain a host fallback command: %#v", args)
	}
	if !containsPrefix(args, "type=bind,source=") {
		t.Fatalf("docker args missing bind mount: %#v", args)
	}
	if !containsSuffix(args, ",target=/workspace") {
		t.Fatalf("docker args missing workspace target: %#v", args)
	}
}

func TestDockerRunnerReturnsUnavailableWithoutDockerBinary(t *testing.T) {
	runner := DockerRunner{
		image:        DefaultImage,
		dockerBinary: "go-course-docker-does-not-exist",
		limits:       DefaultLimits(),
	}
	result := runner.Run(context.Background(), Request{
		Code:       "package main\nfunc main() {}\n",
		HiddenTest: "package main\nimport \"testing\"\nfunc TestLesson(t *testing.T) {}\n",
	})
	if result.Status != StatusRunnerUnavailable {
		t.Fatalf("Run() status = %q, want %q", result.Status, StatusRunnerUnavailable)
	}
}

func containsArg(args []string, want string) bool {
	for _, arg := range args {
		if arg == want {
			return true
		}
	}
	return false
}

func containsPrefix(args []string, prefix string) bool {
	for _, arg := range args {
		if strings.HasPrefix(arg, prefix) {
			return true
		}
	}
	return false
}

func containsSuffix(args []string, suffix string) bool {
	for _, arg := range args {
		if strings.HasSuffix(arg, suffix) {
			return true
		}
	}
	return false
}
