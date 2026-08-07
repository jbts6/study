package runner

import (
	"context"
	"os"
	"os/exec"
	"testing"
)

func TestDockerRunnerWithBuiltImage(t *testing.T) {
	if os.Getenv("GO_COURSE_DOCKER_INTEGRATION") != "1" {
		t.Skip("Docker integration is opt-in; set GO_COURSE_DOCKER_INTEGRATION=1")
	}
	if _, err := exec.LookPath("docker"); err != nil {
		t.Skip("Docker CLI unavailable")
	}
	if err := exec.Command("docker", "info").Run(); err != nil {
		t.Skip("Docker daemon unavailable")
	}
	if err := exec.Command("docker", "image", "inspect", DefaultImage).Run(); err != nil {
		t.Skip("runner image is not built")
	}

	result := (&DockerRunner{
		image:        DefaultImage,
		dockerBinary: "docker",
		limits:       DefaultLimits(),
	}).Run(context.Background(), Request{
		Code:       "package main\nfunc main() {}\n",
		HiddenTest: "package main\nimport \"testing\"\nfunc TestLesson(t *testing.T) {}\n",
	})
	if result.Status != StatusPassed {
		t.Fatalf("built image result = %#v, want passed", result)
	}
}
