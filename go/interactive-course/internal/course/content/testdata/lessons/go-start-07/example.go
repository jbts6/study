package main

import "fmt"

type Counter struct {
	value int
}

func (counter *Counter) Add(delta int) {
	counter.value += delta
}

func (counter Counter) Value() int {
	return counter.value
}

func main() {
	var counter Counter
	counter.Add(3)
	counter.Add(4)
	fmt.Println(counter.Value())
}
