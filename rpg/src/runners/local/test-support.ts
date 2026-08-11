import path from "node:path";
import { fileURLToPath } from "node:url";
import { PythonBridge } from "./python-bridge";
import { detectPython } from "./python-detector";
import type { RunRequest, RunResult } from "../protocol/types";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const daemonScript = path.join(moduleDir, "../python/runtime/daemon.py");

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

export function sendAndWait(
  bridge: PythonBridge,
  request: RunRequest,
  timeoutMs = 5_000,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout waiting for ${request.runId}`)),
      timeoutMs,
    );
    bridge.onMessage = (result) => {
      if (result.runId !== request.runId || result.attemptId !== request.attemptId) return;
      clearTimeout(timer);
      resolve(result);
    };
    if (!bridge.send(request)) {
      clearTimeout(timer);
      reject(new Error("python bridge rejected request"));
    }
  });
}

export async function withPythonBridge<T>(
  callback: (bridge: PythonBridge) => Promise<T>,
): Promise<T> {
  const detection = await requireDetectedPython();
  const bridge = new PythonBridge({ pythonPath: detection.path, daemonScript });
  try {
    await bridge.waitReady();
    return await callback(bridge);
  } finally {
    bridge.kill();
  }
}
