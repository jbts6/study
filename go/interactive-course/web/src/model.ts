export type ExecutionStatus =
  | "passed"
  | "compile_error"
  | "test_failed"
  | "timeout"
  | "runner_unavailable"
  | "invalid_request";

export interface TestDefinition {
  id: string;
  label: string;
}

export interface Lesson {
  id: string;
  title: string;
  goal: string;
  explanation: string;
  exampleCode: string;
  starterCode: string;
  exerciseGoal: string;
  hints: string[];
  tests: TestDefinition[];
}

export interface Course {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Diagnostic {
  line?: number;
  column?: number;
  message: string;
}

export interface TestResult {
  name: string;
  status: "passed" | "failed";
  message: string;
}

export interface ExecuteResult {
  status: ExecutionStatus;
  stdout: string;
  stderr: string;
  diagnostics: Diagnostic[];
  tests: TestResult[];
}

export type RunState =
  | { status: "idle" }
  | { status: "running" }
  | { status: ExecutionStatus; result: ExecuteResult };

export interface CourseState {
  selectedLessonId: string;
  completedLessonIds: string[];
  drafts: Record<string, string>;
  run: RunState;
}
