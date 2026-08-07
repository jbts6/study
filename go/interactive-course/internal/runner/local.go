package runner

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"strings"
)

type LocalConfig struct {
	GoBinary string
	Limits   Limits
	TempRoot string
}

type LocalRunner struct {
	goBinary string
	limits   Limits
	tempRoot string
}

func NewLocalRunner() *LocalRunner {
	return NewLocalRunnerWithConfig(LocalConfig{})
}

func NewLocalRunnerWithConfig(config LocalConfig) *LocalRunner {
	if strings.TrimSpace(config.GoBinary) == "" {
		config.GoBinary = "go"
	}
	if config.Limits.MaxCodeBytes == 0 {
		config.Limits = DefaultLimits()
	}
	return &LocalRunner{
		goBinary: config.GoBinary,
		limits:   config.Limits,
		tempRoot: config.TempRoot,
	}
}

func (r *LocalRunner) Run(ctx context.Context, request Request) Result {
	if err := ValidateCode(request.Code, r.limits.MaxCodeBytes); err != nil {
		return Result{Status: StatusInvalidRequest, Stderr: err.Error()}
	}
	if strings.TrimSpace(request.HiddenTest) == "" {
		return Result{Status: StatusInvalidRequest, Stderr: "课程测试不可用"}
	}
	if _, err := exec.LookPath(r.goBinary); err != nil {
		return Result{Status: StatusRunnerUnavailable, Stderr: "本机 Go 工具链不可用"}
	}

	workDir, err := os.MkdirTemp(r.tempRoot, "go-course-local-")
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
	command := exec.CommandContext(runContext, r.goBinary, "test", "-json", "-v", "-count=1", "./...")
	command.Dir = workDir
	command.Env = append(os.Environ(),
		"GOTOOLCHAIN=local",
		"GOPROXY=off",
		"GOSUMDB=off",
		"GOTELEMETRY=off",
	)
	stdout, stderr := newSharedLimitedWriters(limits.MaxOutputBytes)
	command.Stdout = stdout
	command.Stderr = stderr
	err = command.Run()

	status := classifyLocalRunError(err, runContext)
	if status == StatusTimeout {
		return Result{Status: status, Stderr: "执行超时，请检查是否存在死循环。"}
	}
	if status == StatusRunnerUnavailable {
		return Result{Status: status, Stderr: "本机 Go 工具链不可用，请安装 Go 后重试。"}
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

func classifyLocalRunError(err error, ctx context.Context) Status {
	if errors.Is(ctx.Err(), context.DeadlineExceeded) || errors.Is(err, context.DeadlineExceeded) {
		return StatusTimeout
	}
	if err == nil {
		return ""
	}
	if errors.Is(err, exec.ErrNotFound) {
		return StatusRunnerUnavailable
	}
	return StatusTestFailed
}
