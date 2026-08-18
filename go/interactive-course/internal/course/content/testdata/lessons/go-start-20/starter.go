package main

import "fmt"

type Request struct {
	Headers map[string]string
}

type Handler func(Request) string
type Middleware func(Handler) Handler

func authMiddleware(next Handler) Handler {
	return next
}

func chain(handler Handler, middleware ...Middleware) Handler {
	return handler
}

func main() {
	handler := chain(func(Request) string { return "ok" }, authMiddleware)
	fmt.Println(handler(Request{}))
}
