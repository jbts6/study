package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"study.local/go-interactive-course/internal/api"
	"study.local/go-interactive-course/internal/course"
	"study.local/go-interactive-course/internal/runner"
)

func main() {
	address := flag.String("addr", "127.0.0.1:8080", "HTTP 监听地址")
	runnerMode := flag.String("runner-mode", "local", "代码执行模式：local 或 docker")
	image := flag.String("runner-image", runner.DefaultImage, "隔离执行器镜像")
	flag.Parse()

	handler, err := newHandlerWithMode(*runnerMode, *image)
	if err != nil {
		log.Fatal(err)
	}

	server := &http.Server{
		Addr:              *address,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       30 * time.Second,
	}
	log.Printf("Go 交互式课程服务监听 http://%s", *address)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func newHandler(image string) (http.Handler, error) {
	return newHandlerWithMode("local", image)
}

func newHandlerWithMode(mode, image string) (http.Handler, error) {
	catalog, err := course.LoadCatalog()
	if err != nil {
		return nil, fmt.Errorf("加载课程失败: %w", err)
	}
	executionRunner, err := newRunner(mode, image)
	if err != nil {
		return nil, err
	}
	return api.NewHandler(catalog, executionRunner), nil
}

func newRunner(mode, image string) (runner.Runner, error) {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "", "local":
		return runner.NewLocalRunner(), nil
	case "docker":
		return runner.NewDockerRunner(image), nil
	default:
		return nil, fmt.Errorf("不支持的代码执行模式 %q，请使用 local 或 docker", mode)
	}
}
