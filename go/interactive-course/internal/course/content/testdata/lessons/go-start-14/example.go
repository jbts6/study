package main

import (
	"fmt"
	"strings"
)

func summarizeText(text string) (words int, lines int) {
	if text == "" {
		return 0, 0
	}
	return len(strings.Fields(text)), strings.Count(text, "\n") + 1
}

func main() {
	words, lines := summarizeText("Go is clear\nand small")
	fmt.Println(words, lines)
}
