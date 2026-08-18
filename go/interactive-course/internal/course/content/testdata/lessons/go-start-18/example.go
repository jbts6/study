package main

import "fmt"

type TextHandler func(string) string
type TextMiddleware func(TextHandler) TextHandler

func withPrefix(prefix string) TextMiddleware {
	return func(next TextHandler) TextHandler {
		return func(input string) string {
			return prefix + next(input)
		}
	}
}

func applyTextMiddleware(handler TextHandler, middleware ...TextMiddleware) TextHandler {
	for index := len(middleware) - 1; index >= 0; index-- {
		handler = middleware[index](handler)
	}
	return handler
}

func main() {
	base := func(input string) string { return "[" + input + "]" }
	handler := applyTextMiddleware(base, withPrefix("result: "))
	fmt.Println(handler("go"))
}
