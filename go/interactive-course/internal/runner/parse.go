package runner

import (
	"bufio"
	"encoding/base64"
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
)

const programOutputMarker = "GO_COURSE_STDOUT:"

type goTestEvent struct {
	Action  string  `json:"Action"`
	Package string  `json:"Package"`
	Test    string  `json:"Test"`
	Output  string  `json:"Output"`
	Elapsed float64 `json:"Elapsed"`
}

var diagnosticPattern = regexp.MustCompile(`(?:^|\s)(?:\./)?(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+\.go:([0-9]+)(?::([0-9]+))?:\s*(.+)$`)

func parseGoTestJSON(stdout, stderr string, labels map[string]string) Result {
	result := Result{Status: StatusPassed, Tests: make([]TestResult, 0)}
	tests := make(map[string]*TestResult)
	order := make([]string, 0)
	failedPackage := false

	scanner := bufio.NewScanner(strings.NewReader(stdout))
	scanner.Buffer(make([]byte, 1024), 256*1024)
	for scanner.Scan() {
		var event goTestEvent
		if err := json.Unmarshal(scanner.Bytes(), &event); err != nil {
			continue
		}
		if event.Test != "" && (event.Action == "run" || event.Action == "pass" || event.Action == "fail") {
			if _, exists := tests[event.Test]; !exists {
				name := event.Test
				name = labelForTest(event.Test, labels)
				tests[event.Test] = &TestResult{Name: name, Status: TestPassed}
				order = append(order, event.Test)
			}
			if event.Action == "fail" {
				tests[event.Test].Status = TestFailed
			}
		}
		if event.Action == "fail" && event.Test == "" {
			failedPackage = true
		}
		if event.Output != "" {
			parseEventOutput(&result, tests[event.Test], event.Output)
		}
	}

	for _, key := range order {
		test := *tests[key]
		if test.Status == TestFailed && strings.TrimSpace(test.Message) == "" {
			test.Message = "测试未通过"
		}
		result.Tests = append(result.Tests, test)
	}
	result.Diagnostics = append(result.Diagnostics, parseDiagnostics(stderr)...)
	if len(result.Diagnostics) > 0 {
		result.Status = StatusCompileError
	} else if failedPackage || hasFailedTest(result.Tests) || strings.Contains(stderr, "FAIL") {
		result.Status = StatusTestFailed
	}
	return result
}

func labelForTest(testName string, labels map[string]string) string {
	if label, ok := labels[testName]; ok {
		return label
	}
	for parent := testName; ; {
		separator := strings.LastIndex(parent, "/")
		if separator < 0 {
			return testName
		}
		parent = parent[:separator]
		if label, ok := labels[parent]; ok {
			return label + " / " + testName[separator+1:]
		}
	}
}

func parseEventOutput(result *Result, test *TestResult, output string) {
	for _, rawLine := range strings.Split(output, "\n") {
		line := strings.TrimSpace(rawLine)
		if line == "" {
			continue
		}
		if marker := strings.Index(line, programOutputMarker); marker >= 0 {
			encoded := strings.TrimSpace(line[marker+len(programOutputMarker):])
			if decoded, err := base64.StdEncoding.DecodeString(encoded); err == nil {
				result.Stdout += string(decoded)
			}
			continue
		}
		if test == nil {
			if diagnostic, ok := parseDiagnosticLine(line); ok {
				result.Diagnostics = append(result.Diagnostics, diagnostic)
			}
		}
		if test != nil && !strings.HasPrefix(line, "=== ") && !strings.HasPrefix(line, "--- ") {
			if test.Message != "" {
				test.Message += "\n"
			}
			test.Message += line
		}
	}
}

func parseDiagnostics(output string) []Diagnostic {
	diagnostics := make([]Diagnostic, 0)
	for _, line := range strings.Split(output, "\n") {
		if diagnostic, ok := parseDiagnosticLine(strings.TrimSpace(line)); ok {
			diagnostics = append(diagnostics, diagnostic)
		}
	}
	return diagnostics
}

func parseDiagnosticLine(line string) (Diagnostic, bool) {
	matches := diagnosticPattern.FindStringSubmatch(line)
	if len(matches) != 4 {
		return Diagnostic{}, false
	}
	lineNumber, err := strconv.Atoi(matches[1])
	if err != nil {
		return Diagnostic{}, false
	}
	column := 0
	if matches[2] != "" {
		column, err = strconv.Atoi(matches[2])
		if err != nil {
			return Diagnostic{}, false
		}
	}
	return Diagnostic{Line: lineNumber, Column: column, Message: matches[3]}, true
}

func hasFailedTest(tests []TestResult) bool {
	for _, test := range tests {
		if test.Status == TestFailed {
			return true
		}
	}
	return false
}
