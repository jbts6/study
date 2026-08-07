package runner

import (
	"strings"
	"testing"
)

func TestParseGoTestJSONPassesAndExtractsStdout(t *testing.T) {
	output := strings.Join([]string{
		`{"Action":"run","Package":"exercise","Test":"TestHelloGoOutput"}`,
		`{"Action":"output","Package":"exercise","Test":"TestHelloGoOutput","Output":"    hidden_test.go:4: GO_COURSE_STDOUT:SGVsbG8sIEdvIQo=\n"}`,
		`{"Action":"pass","Package":"exercise","Test":"TestHelloGoOutput","Elapsed":0.01}`,
		`{"Action":"pass","Package":"exercise","Elapsed":0.01}`,
	}, "\n")
	result := parseGoTestJSON(output, "", map[string]string{"TestHelloGoOutput": "输出欢迎语"})

	if result.Status != StatusPassed {
		t.Fatalf("status = %q, want %q", result.Status, StatusPassed)
	}
	if result.Stdout != "Hello, Go!\n" {
		t.Fatalf("stdout = %q, want %q", result.Stdout, "Hello, Go!\\n")
	}
	if len(result.Tests) != 1 || result.Tests[0].Name != "输出欢迎语" || result.Tests[0].Status != TestPassed {
		t.Fatalf("tests = %#v, want one labeled passing test", result.Tests)
	}
}

func TestParseGoTestJSONDetectsCompileDiagnostic(t *testing.T) {
	output := `{"Action":"output","Package":"exercise","Output":"# exercise\n./main.go:7:2: undefined: missing\nFAIL\texercise [build failed]\n"}`
	result := parseGoTestJSON(output, "", nil)

	if result.Status != StatusCompileError {
		t.Fatalf("status = %q, want %q", result.Status, StatusCompileError)
	}
	if len(result.Diagnostics) != 1 || result.Diagnostics[0].Line != 7 || result.Diagnostics[0].Column != 2 {
		t.Fatalf("diagnostics = %#v, want main.go line 7 column 2", result.Diagnostics)
	}
}

func TestParseGoTestJSONDetectsTestFailureMessage(t *testing.T) {
	output := strings.Join([]string{
		`{"Action":"run","Package":"exercise","Test":"TestSum"}`,
		`{"Action":"output","Package":"exercise","Test":"TestSum","Output":"    hidden_test.go:12: got 4, want 6\n"}`,
		`{"Action":"fail","Package":"exercise","Test":"TestSum","Elapsed":0.01}`,
		`{"Action":"fail","Package":"exercise","Elapsed":0.01}`,
	}, "\n")
	result := parseGoTestJSON(output, "", map[string]string{"TestSum": "求和结果"})

	if result.Status != StatusTestFailed {
		t.Fatalf("status = %q, want %q", result.Status, StatusTestFailed)
	}
	if len(result.Tests) != 1 || result.Tests[0].Name != "求和结果" || result.Tests[0].Status != TestFailed || !strings.Contains(result.Tests[0].Message, "got 4, want 6") {
		t.Fatalf("tests = %#v, want labeled failure with assertion message", result.Tests)
	}
}

func TestLimitedWriterTruncatesOutput(t *testing.T) {
	writer := newLimitedWriter(4)
	if _, err := writer.Write([]byte("abcdef")); err != nil {
		t.Fatalf("Write() error = %v", err)
	}
	if writer.String() != "abcd" || !writer.Truncated() {
		t.Fatalf("limited writer = %q, truncated = %v, want abcd/true", writer.String(), writer.Truncated())
	}
}

func TestParseGoTestJSONIgnoresUnknownEvents(t *testing.T) {
	result := parseGoTestJSON(`{"Action":"skip","Package":"exercise","Test":"TestOptional"}`, "", nil)
	if result.Status != StatusPassed || len(result.Tests) != 0 {
		t.Fatalf("unknown event result = %#v, want clean passing result", result)
	}
}

func TestParseGoTestJSONLabelsSubtestsByParent(t *testing.T) {
	output := `{"Action":"pass","Package":"exercise","Test":"TestSum/empty"}`
	result := parseGoTestJSON(output, "", map[string]string{"TestSum": "求和结果"})
	if len(result.Tests) != 1 || result.Tests[0].Name != "求和结果 / empty" {
		t.Fatalf("subtest = %#v, want parent label with subtest name", result.Tests)
	}
}
