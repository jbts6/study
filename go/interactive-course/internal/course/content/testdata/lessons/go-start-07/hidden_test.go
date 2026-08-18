package main

import "testing"

func TestCounterMethods(t *testing.T) {
	var counter Counter
	counter.Add(3)
	counter.Add(4)
	if got := counter.Value(); got != 7 {
		t.Fatalf("counter.Value() = %d, want 7", got)
	}
}
