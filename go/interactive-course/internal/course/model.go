package course

// Course is the complete server-side representation of a course.
type Course struct {
	ID      string   `json:"id"`
	Title   string   `json:"title"`
	Lessons []Lesson `json:"lessons"`
}

// Lesson contains public lesson data and the server-only hidden test source.
type Lesson struct {
	PublicLesson
	HiddenTest string `json:"-"`
}

// TestDefinition describes a test label that can be shown to learners.
type TestDefinition struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// PublicCourse is the course DTO safe to serialize for clients.
type PublicCourse struct {
	ID      string         `json:"id"`
	Title   string         `json:"title"`
	Lessons []PublicLesson `json:"lessons"`
}

// PublicLesson is lesson content without server-only execution inputs.
type PublicLesson struct {
	ID           string           `json:"id"`
	Title        string           `json:"title"`
	Goal         string           `json:"goal"`
	Explanation  string           `json:"explanation"`
	ExampleCode  string           `json:"exampleCode"`
	StarterCode  string           `json:"starterCode"`
	ExerciseGoal string           `json:"exerciseGoal"`
	Hints        []string         `json:"hints"`
	Tests        []TestDefinition `json:"tests"`
}
