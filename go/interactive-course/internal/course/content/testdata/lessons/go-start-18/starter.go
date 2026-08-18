package main

import "fmt"

type TextHandler func(string) string
type TextMiddleware func(TextHandler) TextHandler

func withPrefix(prefix string) TextMiddleware {
	return func(next TextHandler) TextHandler {
		return next
	}
}

func applyTextMiddleware(handler TextHandler, middleware ...TextMiddleware) TextHandler {
	return handler
}

func main() {
	handler := applyTextMiddleware(func(input string) string { return input }, withPrefix("result: "))
	fmt.Println(handler("go"))
}
