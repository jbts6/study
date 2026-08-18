package main

import "testing"

func TestSummarizeText(t *testing.T) {
	words, lineCount := summarizeText("Go is clear\nand small")
	if words != 5 || lineCount != 2 {
		t.Fatalf("summarizeText() = %d, %d; want 5, 2", words, lineCount)
	}
	words, lineCount = summarizeText("")
	if words != 0 || lineCount != 0 {
		t.Fatalf("summarizeText(empty) = %d, %d", words, lineCount)
	}
}
