package main

import (
	"fmt"
	"strconv"
	"strings"
)

func parsePositive(input string) (int, error) {
	value, err := strconv.Atoi(strings.TrimSpace(input))
	if err != nil {
		return 0, fmt.Errorf("invalid number: %w", err)
	}
	if value <= 0 {
		return 0, fmt.Errorf("value must be positive")
	}
	return value, nil
}

func main() {
	value, _ := parsePositive(" 12 ")
	fmt.Println(value)
}
