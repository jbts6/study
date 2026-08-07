package main

import (
	"io"
	"os"
	"testing"
)

func TestClassifyScoreBoundaries(t *testing.T) {
	tests := []struct {
		score int
		want  string
	}{
		{score: 100, want: "excellent"},
		{score: 60, want: "pass"},
		{score: 59, want: "retry"},
	}

	for _, tt := range tests {
		if got := classify(tt.score); got != tt.want {
			t.Errorf("classify(%d) = %q, want %q", tt.score, got, tt.want)
		}
	}
}

func TestMainPrintsClassificationExample(t *testing.T) {
	if output := captureProgramOutput(t, main); output != "pass\n" {
		t.Fatalf("main output = %q, want %q", output, "pass\n")
	}
}

func captureProgramOutput(t *testing.T, run func()) string {
	t.Helper()

	original := os.Stdout
	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatalf("create output pipe: %v", err)
	}
	os.Stdout = writer
	run()
	if err := writer.Close(); err != nil {
		t.Fatalf("close output pipe: %v", err)
	}
	os.Stdout = original

	output, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read captured output: %v", err)
	}
	_ = reader.Close()
	return string(output)
}
