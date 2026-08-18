package main

import "testing"

type fixedMeasure float64

func (value fixedMeasure) Measure() float64 { return float64(value) }

func TestTotalMeasure(t *testing.T) {
	items := []Measurable{Rectangle{Width: 3, Height: 4}, fixedMeasure(2.5)}
	if got := totalMeasure(items); got != 14.5 {
		t.Fatalf("totalMeasure() = %v, want 14.5", got)
	}
}
