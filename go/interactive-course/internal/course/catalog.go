package course

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"path"
	"strings"
)

//go:embed content/course.json content/lessons/*
var embeddedContent embed.FS

var expectedLessonIDs = []string{
	"go-start-01",
	"go-start-02",
	"go-start-03",
	"go-start-04",
}

// Catalog provides validated course data and server-only lesson tests.
type Catalog struct {
	course  Course
	lessons map[string]Lesson
}

// LoadCatalog loads and validates the embedded course catalog.
func LoadCatalog() (*Catalog, error) {
	return loadCatalog(embeddedContent)
}

func loadCatalog(files fs.FS) (*Catalog, error) {
	data, err := fs.ReadFile(files, "content/course.json")
	if err != nil {
		return nil, fmt.Errorf("read course metadata: %w", err)
	}

	var course Course
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&course); err != nil {
		return nil, fmt.Errorf("decode course metadata: %w", err)
	}
	if err := ensureEOF(decoder); err != nil {
		return nil, fmt.Errorf("decode course metadata: %w", err)
	}
	if err := validateCourseMetadata(course); err != nil {
		return nil, err
	}

	lessonIDs := make(map[string]struct{}, len(course.Lessons))
	lessons := make(map[string]Lesson, len(course.Lessons))
	for _, metadata := range course.Lessons {
		lessonIDs[metadata.ID] = struct{}{}
		lesson, err := loadLesson(files, metadata)
		if err != nil {
			return nil, err
		}
		lessons[lesson.ID] = lesson
	}
	if err := validateLessonDirectories(files, lessonIDs); err != nil {
		return nil, err
	}

	course.Lessons = make([]Lesson, 0, len(lessons))
	for _, id := range expectedLessonIDs {
		course.Lessons = append(course.Lessons, lessons[id])
	}
	return &Catalog{course: course, lessons: lessons}, nil
}

func loadLesson(files fs.FS, metadata Lesson) (Lesson, error) {
	metadata.ExampleCode = ""
	metadata.StarterCode = ""

	for field, filename := range map[string]string{
		"example code": "example.go",
		"starter code": "starter.go",
		"hidden test":  "hidden_test.go",
	} {
		content, err := readRequiredLessonFile(files, metadata.ID, filename)
		if err != nil {
			return Lesson{}, err
		}
		switch field {
		case "example code":
			metadata.ExampleCode = content
		case "starter code":
			metadata.StarterCode = content
		case "hidden test":
			metadata.HiddenTest = content
		}
	}
	if err := validateLesson(metadata); err != nil {
		return Lesson{}, err
	}
	return metadata, nil
}

func readRequiredLessonFile(files fs.FS, lessonID, filename string) (string, error) {
	filePath := path.Join("content/lessons", lessonID, filename)
	data, err := fs.ReadFile(files, filePath)
	if err != nil {
		return "", fmt.Errorf("lesson %q missing %s: %w", lessonID, filename, err)
	}
	content := string(data)
	if strings.TrimSpace(content) == "" {
		return "", fmt.Errorf("lesson %q has empty %s", lessonID, filename)
	}
	return content, nil
}

func validateCourseMetadata(course Course) error {
	if strings.TrimSpace(course.ID) == "" || strings.TrimSpace(course.Title) == "" {
		return fmt.Errorf("course ID and title must not be empty")
	}
	if len(course.Lessons) != len(expectedLessonIDs) {
		return fmt.Errorf("course must contain exactly %d lessons", len(expectedLessonIDs))
	}

	seen := make(map[string]struct{}, len(course.Lessons))
	for index, lesson := range course.Lessons {
		if lesson.ID != expectedLessonIDs[index] {
			return fmt.Errorf("lesson %d has ID %q, want %q", index, lesson.ID, expectedLessonIDs[index])
		}
		if _, exists := seen[lesson.ID]; exists {
			return fmt.Errorf("duplicate lesson ID %q", lesson.ID)
		}
		seen[lesson.ID] = struct{}{}
		if err := validateLessonMetadata(lesson); err != nil {
			return err
		}
	}
	return nil
}

func validateLesson(lesson Lesson) error {
	if err := validateLessonMetadata(lesson); err != nil {
		return err
	}
	fields := map[string]string{
		"example code": lesson.ExampleCode,
		"starter code": lesson.StarterCode,
		"hidden test":  lesson.HiddenTest,
	}
	for name, value := range fields {
		if strings.TrimSpace(value) == "" {
			return fmt.Errorf("lesson %q has empty %s", lesson.ID, name)
		}
	}
	return nil
}

func validateLessonMetadata(lesson Lesson) error {
	fields := map[string]string{
		"title":         lesson.Title,
		"goal":          lesson.Goal,
		"explanation":   lesson.Explanation,
		"exercise goal": lesson.ExerciseGoal,
	}
	for name, value := range fields {
		if strings.TrimSpace(value) == "" {
			return fmt.Errorf("lesson %q has empty %s", lesson.ID, name)
		}
	}
	if len(lesson.Hints) == 0 {
		return fmt.Errorf("lesson %q has no hints", lesson.ID)
	}
	for _, hint := range lesson.Hints {
		if strings.TrimSpace(hint) == "" {
			return fmt.Errorf("lesson %q has an empty hint", lesson.ID)
		}
	}
	if len(lesson.Tests) == 0 {
		return fmt.Errorf("lesson %q has no public tests", lesson.ID)
	}
	seen := make(map[string]struct{}, len(lesson.Tests))
	for _, test := range lesson.Tests {
		if strings.TrimSpace(test.ID) == "" || strings.TrimSpace(test.Label) == "" {
			return fmt.Errorf("lesson %q has an incomplete public test", lesson.ID)
		}
		if _, exists := seen[test.ID]; exists {
			return fmt.Errorf("lesson %q has duplicate public test ID %q", lesson.ID, test.ID)
		}
		seen[test.ID] = struct{}{}
	}
	return nil
}

func validateLessonDirectories(files fs.FS, lessonIDs map[string]struct{}) error {
	entries, err := fs.ReadDir(files, "content/lessons")
	if err != nil {
		return fmt.Errorf("read lesson directories: %w", err)
	}
	if len(entries) != len(lessonIDs) {
		return fmt.Errorf("lesson directory count = %d, want %d", len(entries), len(lessonIDs))
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			return fmt.Errorf("unexpected file in lesson directory: %q", entry.Name())
		}
		if _, ok := lessonIDs[entry.Name()]; !ok {
			return fmt.Errorf("lesson directory %q is not declared in course metadata", entry.Name())
		}
	}
	return nil
}

func ensureEOF(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		if err == nil {
			return fmt.Errorf("multiple JSON documents")
		}
		return err
	}
	return nil
}

// PublicCourse returns a deep copy of the client-safe course DTO.
func (c *Catalog) PublicCourse() PublicCourse {
	public := PublicCourse{ID: c.course.ID, Title: c.course.Title}
	public.Lessons = make([]PublicLesson, 0, len(c.course.Lessons))
	for _, lesson := range c.course.Lessons {
		public.Lessons = append(public.Lessons, clonePublicLesson(lesson.PublicLesson))
	}
	return public
}

// Lesson returns a validated lesson, including its server-only hidden test.
func (c *Catalog) Lesson(id string) (Lesson, bool) {
	lesson, ok := c.lessons[id]
	return lesson, ok
}

func clonePublicLesson(lesson PublicLesson) PublicLesson {
	clone := lesson
	clone.Hints = append([]string(nil), lesson.Hints...)
	clone.Tests = append([]TestDefinition(nil), lesson.Tests...)
	return clone
}
