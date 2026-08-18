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
	return 0
}

func totalMeasure(items []Measurable) float64 {
	return 0
}

func main() {
	fmt.Println(totalMeasure([]Measurable{Rectangle{Width: 3, Height: 4}}))
}
