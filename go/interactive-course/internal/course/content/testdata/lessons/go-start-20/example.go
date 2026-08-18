package main

import "fmt"

type Request struct {
	Headers map[string]string
}

type Handler func(Request) string
type Middleware func(Handler) Handler

func authMiddleware(next Handler) Handler {
	return func(request Request) string {
		if request.Headers["X-Token"] != "study" {
			return "unauthorized"
		}
		return next(request)
	}
}

func chain(handler Handler, middleware ...Middleware) Handler {
	for index := len(middleware) - 1; index >= 0; index-- {
		handler = middleware[index](handler)
	}
	return handler
}

func main() {
	handler := chain(func(Request) string { return "ok" }, authMiddleware)
	fmt.Println(handler(Request{Headers: map[string]string{"X-Token": "study"}}))
}
