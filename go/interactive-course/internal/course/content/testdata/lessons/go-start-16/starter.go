package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
)

func newStatusHandler() http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusNotImplemented)
	})
}

func main() {
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	recorder := httptest.NewRecorder()
	newStatusHandler().ServeHTTP(recorder, request)
	fmt.Println(recorder.Code)
}
