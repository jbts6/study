package main

import "fmt"

type Measurable interface {
	Measure() float64
}

type Rectangle struct {
	Width  float64
	Height float64
}

func (rectangle Rectangle) Measure() float64 {
	return rectangle.Width * rectangle.Height
}

func totalMeasure(items []Measurable) float64 {
	total := 0.0
	for _, item := range items {
		total += item.Measure()
	}
	return total
}

func main() {
	fmt.Println(totalMeasure([]Measurable{Rectangle{Width: 3, Height: 4}}))
}
