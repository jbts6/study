package runner

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type DockerConfig struct {
	Image        string
	DockerBinary string
	Limits       Limits
	TempRoot     string
}

type DockerRunner struct {
	image        string
	dockerBinary string
	limits       Limits
	tempRoot     string
}

func NewDockerRunner(image string) *DockerRunner {
	return NewDockerRunnerWithConfig(DockerConfig{Image: image})
}

func NewDockerRunnerWithConfig(config DockerConfig) *DockerRunner {
	if strings.TrimSpace(config.Image) == "" {
		config.Image = DefaultImage
	}
	if strings.TrimSpace(config.DockerBinary) == "" {
		config.DockerBinary = "docker"
	}
	if config.Limits.MaxCodeBytes == 0 {
		config.Limits = DefaultLimits()
	}
	return &DockerRunner{
		image:        config.Image,
		dockerBinary: config.DockerBinary,
		limits:       config.Limits,
		tempRoot:     config.TempRoot,
	}
}

func (r *DockerRunner) Run(ctx context.Context, request Request) Result {
	if err := ValidateCode(request.Code, r.limits.MaxCodeBytes); err != nil {
		return Result{Status: StatusInvalidRequest, Stderr: err.Error()}
	}
	if strings.TrimSpace(request.HiddenTest) == "" {
		return Result{Status: StatusInvalidRequest, Stderr: "课程测试不可用"}
	}
	if _, err := exec.LookPath(r.dockerBinary); err != nil {
		return Result{Status: StatusRunnerUnavailable, Stderr: "执行服务不可用"}
	}

	workDir, err := os.MkdirTemp(r.tempRoot, "go-course-run-")
	if err != nil {
		return Result{Status: StatusRunnerUnavailable, Stderr: "无法创建执行环境"}
	}
	defer os.RemoveAll(workDir)
	if err := writeSubmission(workDir, request); err != nil {
		return Result{Status: StatusRunnerUnavailable, Stderr: "无法准备执行环境"}
	}

	limits := r.limits
	if limits.Timeout <= 0 {
		limits.Timeout = DefaultTimeout
	}
	runContext, cancel := context.WithTimeout(ctx, limits.Timeout)
	defer cancel()
	command := exec.CommandContext(runContext, r.dockerBinary, buildDockerArgs(workDir, r.image, limits)...)
	stdout := newLimitedWriter(limits.MaxOutputBytes)
	stderr := newLimitedWriter(limits.MaxOutputBytes)
	command.Stdout = stdout
	command.Stderr = stderr
	err = command.Run()

	status := classifyRunError(err, stderr.String(), runContext)
	if status == StatusTimeout {
		return Result{Status: status, Stderr: "执行超时，请检查是否存在死循环。"}
	}
	if status == StatusRunnerUnavailable {
		return Result{Status: status, Stderr: "执行服务不可用，请启动 Docker 后重试。"}
	}

	result := parseGoTestJSON(stdout.String(), stderr.String(), request.TestLabels)
	if err != nil && result.Status == StatusPassed {
		result.Status = StatusTestFailed
		result.Stderr = "执行失败，请检查代码后重试。"
	}
	if result.Stderr == "" {
		result.Stderr = stderr.String()
	}
	if stdout.Truncated() || stderr.Truncated() {
		if result.Stderr != "" {
			result.Stderr += "\n"
		}
		result.Stderr += "输出超过限制，已截断。"
	}
	result.Stderr = sanitizeRunnerMessage(result.Stderr, workDir)
	return result
}

func buildDockerArgs(sourceDir, image string, limits Limits) []string {
	if limits.CPUs == "" || limits.Memory == "" || limits.PidsLimit == 0 || limits.Tmpfs == "" {
		limits = DefaultLimits()
	}
	source := filepath.ToSlash(filepath.Clean(sourceDir))
	mount := fmt.Sprintf("type=bind,source=%s,target=/workspace", source)
	return []string{
		"run", "--rm", "--network=none", "--read-only", "--user", "10001:10001",
		"--cpus=" + limits.CPUs, "--memory=" + limits.Memory,
		fmt.Sprintf("--pids-limit=%d", limits.PidsLimit), "--cap-drop=ALL",
		"--security-opt=no-new-privileges", "--tmpfs", limits.Tmpfs,
		"--mount", mount, "--workdir", "/workspace",
		"--env", "GOCACHE=/tmp/go-build", "--env", "GOMODCACHE=/tmp/go-mod",
		"--env", "GOPATH=/tmp/go-path", "--env", "GOPROXY=off",
		"--env", "GOSUMDB=off", "--env", "GOTOOLCHAIN=local", "--env", "GOTELEMETRY=off",
		image, "go", "test", "-json", "-v", "-count=1", "./...",
	}
}

func writeSubmission(workDir string, request Request) error {
	files := map[string]string{
		"main.go":        request.Code,
		"go.mod":         "module go-course-exercise\n\ngo 1.25.1\n",
		"hidden_test.go": request.HiddenTest,
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(workDir, name), []byte(content), 0o644); err != nil {
			return err
		}
	}
	return nil
}

func classifyRunError(err error, stderr string, ctx context.Context) Status {
	if errors.Is(ctx.Err(), context.DeadlineExceeded) || errors.Is(err, context.DeadlineExceeded) {
		return StatusTimeout
	}
	if err == nil {
		return ""
	}
	if isDockerUnavailable(stderr) {
		return StatusRunnerUnavailable
	}
	return StatusTestFailed
}

func isDockerUnavailable(message string) bool {
	lower := strings.ToLower(message)
	for _, marker := range []string{
		"cannot connect to the docker daemon",
		"is the docker daemon running",
		"error during connect",
		"docker daemon",
		"no such file or directory",
	} {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

func sanitizeRunnerMessage(message, workDir string) string {
	message = strings.TrimSpace(message)
	if workDir != "" {
		message = strings.ReplaceAll(message, workDir, "<workspace>")
		message = strings.ReplaceAll(message, filepath.ToSlash(workDir), "<workspace>")
	}
	if isDockerUnavailable(message) {
		return "执行服务不可用"
	}
	return message
}
