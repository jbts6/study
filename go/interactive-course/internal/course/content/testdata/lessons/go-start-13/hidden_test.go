package main

import "testing"

func TestFirstMessage(t *testing.T) {
	primary := make(chan string, 1)
	fallback := make(chan string, 1)
	fallback <- "backup"
	if got := firstMessage(primary, fallback); got != "backup" {
		t.Fatalf("firstMessage() = %q, want backup", got)
	}
}
