package main

import "fmt"

type Counter struct {
	value int
}

func (counter *Counter) Add(delta int) {
	// TODO: 更新 counter.value。
}

func (counter Counter) Value() int {
	return 0
}

func main() {
	var counter Counter
	counter.Add(3)
	fmt.Println(counter.Value())
}
