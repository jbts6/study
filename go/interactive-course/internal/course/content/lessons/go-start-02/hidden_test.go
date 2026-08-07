package main

import "testing"

func TestFormatProfileUsesStringAndIntValues(t *testing.T) {
	if got := formatProfile("Ada", 37); got != "Name: Ada, Age: 37" {
		t.Fatalf("formatProfile(Ada, 37) = %q", got)
	}
}

func TestFormatProfileHandlesZeroValues(t *testing.T) {
	if got := formatProfile("", 0); got != "Name: Guest, Age: 0" {
		t.Fatalf("formatProfile(empty, 0) = %q", got)
	}
}
