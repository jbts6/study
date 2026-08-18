package main

import "testing"

func TestAddPoints(t *testing.T) {
	points := 10
	addPoints(&points, 5)
	if points != 15 {
		t.Fatalf("points = %d, want 15", points)
	}
}

func TestAddPointsNil(t *testing.T) {
	addPoints(nil, 5)
}
