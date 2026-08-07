package main

import (
	"io"
	"os"
	"testing"
)

func TestSumHandlesEmptySingleAndManyValues(t *testing.T) {
	tests := []struct {
		name    string
		numbers []int
		want    int
	}{
		{name: "empty", numbers: []int{}, want: 0},
		{name: "single", numbers: []int{7}, want: 7},
		{name: "many", numbers: []int{1, 2, 3, 4}, want: 10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := sum(tt.numbers); got != tt.want {
				t.Fatalf("sum(%v) = %d, want %d", tt.numbers, got, tt.want)
			}
		})
	}
}

func TestMainPrintsSumExample(t *testing.T) {
	if output := captureProgramOutput(t, main); output != "6\n" {
		t.Fatalf("main output = %q, want %q", output, "6\n")
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
