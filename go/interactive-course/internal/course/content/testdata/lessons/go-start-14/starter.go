package main

import (
	"fmt"
	"strings"
)

func summarizeText(text string) (words int, lines int) {
	return len(strings.Fields(text)), 0
}

func main() {
	words, lines := summarizeText("Go is clear\nand small")
	fmt.Println(words, lines)
}
