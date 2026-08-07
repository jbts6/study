package main

import (
	"io"
	"os"
	"testing"
)

func TestHelloGoOutput(t *testing.T) {
	output := captureProgramOutput(t, main)
	if output != "Hello, Go!\n" {
		t.Fatalf("main output = %q, want %q", output, "Hello, Go!\n")
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
