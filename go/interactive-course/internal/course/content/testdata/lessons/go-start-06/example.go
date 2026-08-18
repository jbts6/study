package main

import "fmt"

func addPoints(points *int, amount int) {
	if points == nil {
		return
	}
	*points += amount
}

func main() {
	points := 10
	addPoints(&points, 5)
	fmt.Println(points)
}
