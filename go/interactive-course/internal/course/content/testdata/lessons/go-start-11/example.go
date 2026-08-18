package main

import "fmt"

func parallelSum(numbers []int) int {
	results := make(chan int, 2)
	middle := len(numbers) / 2
	sumPart := func(values []int) {
		total := 0
		for _, value := range values {
			total += value
		}
		results <- total
	}
	go sumPart(numbers[:middle])
	go sumPart(numbers[middle:])
	return <-results + <-results
}

func main() {
	fmt.Println(parallelSum([]int{1, 2, 3, 4}))
}
