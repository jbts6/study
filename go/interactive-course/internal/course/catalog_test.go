package course

import (
	"encoding/json"
	"strings"
	"testing"
	"testing/fstest"
)

func TestLoadCatalogProvidesPublicCourseAndPrivateTests(t *testing.T) {
	catalog, err := LoadCatalog()
	if err != nil {
		t.Fatalf("LoadCatalog() error = %v", err)
	}

	public := catalog.PublicCourse()
	if public.ID != "go-start" {
		t.Fatalf("course ID = %q, want %q", public.ID, "go-start")
	}
	if public.Title != "Go 起步" {
		t.Fatalf("course title = %q, want %q", public.Title, "Go 起步")
	}

	wantIDs := []string{"go-start-01", "go-start-02", "go-start-03", "go-start-04"}
	if len(public.Lessons) != len(wantIDs) {
		t.Fatalf("lesson count = %d, want %d", len(public.Lessons), len(wantIDs))
	}

	for index, lesson := range public.Lessons {
		if lesson.ID != wantIDs[index] {
			t.Errorf("lesson %d ID = %q, want %q", index, lesson.ID, wantIDs[index])
		}
		if strings.TrimSpace(lesson.Title) == "" ||
			strings.TrimSpace(lesson.Goal) == "" ||
			strings.TrimSpace(lesson.Explanation) == "" ||
			strings.TrimSpace(lesson.ExampleCode) == "" ||
			strings.TrimSpace(lesson.StarterCode) == "" ||
			strings.TrimSpace(lesson.ExerciseGoal) == "" {
			t.Errorf("lesson %q has an empty required public field", lesson.ID)
		}
		if len(lesson.Hints) == 0 {
			t.Errorf("lesson %q has no hints", lesson.ID)
		}
		if len(lesson.Tests) == 0 {
			t.Errorf("lesson %q has no public test labels", lesson.ID)
		}

		internalLesson, ok := catalog.Lesson(lesson.ID)
		if !ok {
			t.Errorf("catalog.Lesson(%q) not found", lesson.ID)
			continue
		}
		if strings.TrimSpace(internalLesson.HiddenTest) == "" {
			t.Errorf("lesson %q has no hidden test source", lesson.ID)
		}
	}

	serialized, err := json.Marshal(public)
	if err != nil {
		t.Fatalf("json.Marshal(PublicCourse()) error = %v", err)
	}
	if strings.Contains(string(serialized), "captureProgramOutput") {
		t.Fatalf("public course JSON contains hidden test implementation: %s", serialized)
	}
}

func TestLoadCatalogRejectsInvalidContent(t *testing.T) {
	tests := []struct {
		name string
		fs   func() fstest.MapFS
	}{
		{
			name: "duplicate lesson ID",
			fs: func() fstest.MapFS {
				return fixtureFS([]string{"go-start-01", "go-start-01", "go-start-03", "go-start-04"}, "")
			},
		},
		{
			name: "missing starter file",
			fs: func() fstest.MapFS {
				fsys := fixtureFS(nil, "")
				delete(fsys, "content/lessons/go-start-02/starter.go")
				return fsys
			},
		},
		{
			name: "empty lesson title",
			fs: func() fstest.MapFS {
				return fixtureFS(nil, "title")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := loadCatalog(tt.fs()); err == nil {
				t.Fatalf("loadCatalog() error = nil, want invalid content error")
			}
		})
	}
}

type testLessonMetadata struct {
	ID           string             `json:"id"`
	Title        string             `json:"title"`
	Goal         string             `json:"goal"`
	Explanation  string             `json:"explanation"`
	ExerciseGoal string             `json:"exerciseGoal"`
	Hints        []string           `json:"hints"`
	Tests        []testTestMetadata `json:"tests"`
}

type testTestMetadata struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

func fixtureFS(ids []string, emptyField string) fstest.MapFS {
	if len(ids) == 0 {
		ids = []string{"go-start-01", "go-start-02", "go-start-03", "go-start-04"}
	}

	lessons := make([]testLessonMetadata, 0, len(ids))
	fsys := fstest.MapFS{}
	for index, id := range ids {
		lesson := testLessonMetadata{
			ID:           id,
			Title:        "第" + string(rune('1'+index)) + "节",
			Goal:         "学习 Go",
			Explanation:  "解释",
			ExerciseGoal: "练习",
			Hints:        []string{"提示"},
			Tests:        []testTestMetadata{{ID: "test-" + id, Label: "公开测试"}},
		}
		if index == 0 && emptyField == "title" {
			lesson.Title = ""
		}
		lessons = append(lessons, lesson)

		prefix := "content/lessons/" + id + "/"
		fsys[prefix+"starter.go"] = &fstest.MapFile{Data: []byte("package main\n")}
		fsys[prefix+"example.go"] = &fstest.MapFile{Data: []byte("package main\n")}
		fsys[prefix+"hidden_test.go"] = &fstest.MapFile{Data: []byte("package main\nfunc captureProgramOutput() {}\n")}
	}

	document := struct {
		ID      string               `json:"id"`
		Title   string               `json:"title"`
		Lessons []testLessonMetadata `json:"lessons"`
	}{ID: "go-start", Title: "Go 起步", Lessons: lessons}
	data, err := json.Marshal(document)
	if err != nil {
		panic(err)
	}
	fsys["content/course.json"] = &fstest.MapFile{Data: data}
	return fsys
}
