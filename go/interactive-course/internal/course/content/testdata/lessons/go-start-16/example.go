package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
)

func newStatusHandler() http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			writer.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if request.URL.Path != "/health" {
			http.NotFound(writer, request)
			return
		}
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte("ok"))
	})
}

func main() {
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	recorder := httptest.NewRecorder()
	newStatusHandler().ServeHTTP(recorder, request)
	fmt.Println(recorder.Code, recorder.Body.String())
}
