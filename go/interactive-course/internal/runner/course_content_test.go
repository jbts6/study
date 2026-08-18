package runner_test

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"study.local/go-interactive-course/internal/course"
)

func TestCourseReferencesPassAndStartersFailBehaviorTests(t *testing.T) {
	catalog, err := course.LoadCatalog()
	if err != nil {
		t.Fatalf("course.LoadCatalog() error = %v", err)
	}
	root := t.TempDir()
	writeContentFile(t, filepath.Join(root, "go.mod"), "module content.test\n\ngo 1.25.1\n")

	lessons := catalog.PublicCourse().Lessons
	for _, lesson := range lessons {
		internal, ok := catalog.Lesson(lesson.ID)
		if !ok {
			t.Fatalf("catalog.Lesson(%q) not found", lesson.ID)
		}
		for variant, code := range map[string]string{
			"reference": lesson.ExampleCode,
			"starter":   lesson.StarterCode,
		} {
			dir := filepath.Join(root, variant, lesson.ID)
			if err := os.MkdirAll(dir, 0o755); err != nil {
				t.Fatalf("create %s directory: %v", variant, err)
			}
			writeContentFile(t, filepath.Join(dir, "main.go"), code)
			writeContentFile(t, filepath.Join(dir, "hidden_test.go"), internal.HiddenTest)
		}
	}

	runGoTest(t, root, true, "test", "./reference/...")
	output := runGoTest(t, root, false, "test", "-json", "./starter/...")
	assertEveryStarterHasFailingTest(t, output, lessons)
}

func writeContentFile(t *testing.T, filePath, content string) {
	t.Helper()
	if err := os.WriteFile(filePath, []byte(content), 0o600); err != nil {
		t.Fatalf("write %s: %v", filePath, err)
	}
}

func runGoTest(t *testing.T, dir string, wantSuccess bool, args ...string) []byte {
	t.Helper()
	command := exec.CommandContext(context.Background(), "go", args...)
	command.Dir = dir
	command.Env = append(os.Environ(), "GOTOOLCHAIN=local", "GOPROXY=off", "GOSUMDB=off", "GOTELEMETRY=off")
	output, err := command.CombinedOutput()
	if wantSuccess && err != nil {
		t.Fatalf("go %v failed: %v\n%s", args, err, output)
	}
	if !wantSuccess && err == nil {
		t.Fatalf("go %v unexpectedly passed", args)
	}
	return output
}

func assertEveryStarterHasFailingTest(t *testing.T, output []byte, lessons []course.PublicLesson) {
	t.Helper()
	failedPackages := make(map[string]bool, len(lessons))
	scanner := bufio.NewScanner(bytes.NewReader(output))
	for scanner.Scan() {
		var event struct {
			Action  string `json:"Action"`
			Package string `json:"Package"`
			Test    string `json:"Test"`
		}
		if json.Unmarshal(scanner.Bytes(), &event) == nil && event.Action == "fail" && event.Test != "" {
			failedPackages[event.Package] = true
		}
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("scan go test output: %v", err)
	}
	for _, lesson := range lessons {
		packageName := "content.test/starter/" + lesson.ID
		if !failedPackages[packageName] {
			t.Errorf("starter %s has no failing behavior test", lesson.ID)
		}
	}
}
