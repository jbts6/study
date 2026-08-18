package main

import "fmt"

func addPoints(points *int, amount int) {
	// TODO: 修改 points 指向的值，并处理 nil。
}

func main() {
	points := 10
	addPoints(&points, 5)
	fmt.Println(points)
}
