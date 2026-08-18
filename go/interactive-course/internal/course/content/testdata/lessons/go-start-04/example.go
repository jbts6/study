package main

import "fmt"

func sum(numbers []int) int {
	total := 0
	for _, number := range numbers {
		total += number
	}
	return total
}

func main() {
	fmt.Println(sum([]int{1, 2, 3}))
}
