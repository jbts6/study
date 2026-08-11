import path from "node:path";
import { fileURLToPath } from "node:url";
import { PythonRunProcess } from "./python-process";
import { detectPython } from "./python-detector";
import type { RunRequest, RunResult } from "../protocol/types";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const runOnceScript = path.join(moduleDir, "../python/runtime/run_once.py");

export type DetectedPython = { path: string; version: string };

export async function requireDetectedPython(): Promise<DetectedPython> {
  const detection = await detectPython();
  if (!detection.ok) {
    throw new Error(`Runner integration requires CPython 3.12+: ${detection.code}`);
  }
  return { path: detection.path, version: detection.version };
}

export async function loadPythonDetection(): Promise<DetectedPython | null> {
  const detection = await detectPython();
  return detection.ok ? { path: detection.path, version: detection.version } : null;
}

export async function runPythonRequest(
  request: RunRequest,
  timeoutMs = 5_000,
): Promise<RunResult> {
  const python = await requireDetectedPython();
  const process = new PythonRunProcess({ pythonPath: python.path, script: runOnceScript, request });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      process.result,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timeout waiting for ${request.runId}`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    await process.kill();
  }
}

export async function withDetectedPython<T>(callback: () => Promise<T>): Promise<T> {
  await requireDetectedPython();
  return callback();
}
