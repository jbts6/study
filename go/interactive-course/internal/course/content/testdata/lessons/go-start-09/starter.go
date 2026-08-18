package main

import (
	"fmt"
	"strconv"
)

func parsePositive(input string) (int, error) {
	value, err := strconv.Atoi(input)
	return value, err
}

func main() {
	value, _ := parsePositive("12")
	fmt.Println(value)
}
