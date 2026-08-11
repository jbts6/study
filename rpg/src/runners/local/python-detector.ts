import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type PythonDetection =
  | { ok: true; path: string; version: string }
  | { ok: false; code: "PYTHON_NOT_FOUND" | "PYTHON_VERSION_TOO_LOW"; message: string };

export type PythonProbe = (executable: string) => Promise<{ path: string; version: string } | undefined>;

export interface DetectPythonOptions {
  readonly candidates?: readonly string[];
  readonly probe?: PythonProbe;
}

const DEFAULT_CANDIDATES = ["python3", "python"];
const MIN_MAJOR = 3;
const MIN_MINOR = 12;
const PROBE_TIMEOUT_MS = 2_000;
const DOWNLOAD_URL = "https://www.python.org/downloads/";

function parseVersion(output: string): string | undefined {
  const match = output.match(/Python\s+(\d+\.\d+(?:\.\d+)?)/);
  return match?.[1];
}

function versionIsTooLow(version: string): boolean {
  const [major, minor] = version.split(".").map(Number);
  if (major > MIN_MAJOR) return false;
  if (major < MIN_MAJOR) return true;
  return minor < MIN_MINOR;
}

function compareVersions(a: string, b: string): number {
  const [am, an] = a.split(".").map(Number);
  const [bm, bn] = b.split(".").map(Number);
  if (am !== bm) return am - bm;
  return (an ?? 0) - (bn ?? 0);
}

async function defaultProbe(executable: string): Promise<{ path: string; version: string } | undefined> {
  try {
    const { stdout, stderr } = await execFileAsync(executable, ["--version"]);
    const version = parseVersion(`${stdout}\n${stderr}`);
    return version ? { path: executable, version } : undefined;
  } catch {
    return undefined;
  }
}

async function tryDetect(probe: PythonProbe, executable: string): Promise<{ path: string; version: string } | undefined> {
  try {
    return await Promise.race([
      probe(executable),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), PROBE_TIMEOUT_MS)),
    ]);
  } catch {
    return undefined;
  }
}

export async function detectPython(options: DetectPythonOptions = {}): Promise<PythonDetection> {
  const candidates = options.candidates ?? DEFAULT_CANDIDATES;
  const probe = options.probe ?? defaultProbe;
  const tooLow: { path: string; version: string }[] = [];
  for (const executable of candidates) {
    const found = await tryDetect(probe, executable);
    if (!found) continue;
    if (!versionIsTooLow(found.version)) {
      return { ok: true, path: found.path, version: found.version };
    }
    tooLow.push(found);
  }
  if (tooLow.length > 0) {
    const highest = tooLow.reduce((a, b) => (compareVersions(a.version, b.version) >= 0 ? a : b));
    return {
      ok: false,
      code: "PYTHON_VERSION_TOO_LOW",
      message: `检测到 ${highest.path} 版本 ${highest.version}，需要 3.12+。请从 ${DOWNLOAD_URL} 安装 Python 3.12 或更高版本。`,
    };
  }
  return {
    ok: false,
    code: "PYTHON_NOT_FOUND",
    message: `未检测到 Python 解释器。请从 ${DOWNLOAD_URL} 安装 Python 3.12 或更高版本。`,
  };
}
