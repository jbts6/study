import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { loadPythonDetection } from "../../local/test-support";

const execFileAsync = promisify(execFile);
const python = await loadPythonDetection();

describe.skipIf(!python)("execute output limits (CPython 3.12+)", () => {
  it("clips stdout and stderr independently by utf-8 bytes", async () => {
    if (!python) throw new Error("CPython 3.12+ is required");
    const executePath = path.resolve(process.cwd(), "src/runners/python/runtime/execute.py");
    const script = [
      "import io, json, runpy, time",
      `module = runpy.run_path(${JSON.stringify(executePath)})`,
      "stdout = io.StringIO('中' * 100)",
      "stderr = io.StringIO('错' * 100)",
      "request = {'runId': 'output-limits', 'attemptId': 'a1'}",
      "result = module['_completed_result'](request, time.perf_counter(), None, [], None, stdout, stderr, {'maxOutputBytes': 25})",
      "print(json.dumps(result, ensure_ascii=False))",
    ].join("; ");

    const { stdout } = await execFileAsync(python.path, ["-B", "-c", script], { encoding: "utf8" });
    const result = JSON.parse(stdout) as {
      streams: { stdout: string; stderr: string; truncated: boolean };
    };

    expect(result.streams.truncated).toBe(true);
    for (const stream of [result.streams.stdout, result.streams.stderr]) {
      expect(stream).toContain("[output truncated]");
      expect(Buffer.byteLength(stream, "utf8")).toBeLessThanOrEqual(25);
    }
  });
});
