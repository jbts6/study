import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type PythonDetection =
  | { ok: true; path: string; version: string }
  | { ok: false; code: "PYTHON_NOT_FOUND" | "PYTHON_VERSION_TOO_LOW"; message: string };

const MIN_MAJOR = 3;
const MIN_MINOR = 12;

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

async function tryDetect(
  executable: string,
): Promise<{ path: string; version: string } | undefined> {
  try {
    const { stdout, stderr } = await execFileAsync(executable, ["--version"]);
    const version = parseVersion(`${stdout}\n${stderr}`);
    if (!version) return undefined;
    return { path: executable, version };
  } catch {
    return undefined;
  }
}

export async function detectPython(): Promise<PythonDetection> {
  for (const executable of ["python3", "python"]) {
    const found = await tryDetect(executable);
    if (found) {
      if (versionIsTooLow(found.version)) {
        return {
          ok: false,
          code: "PYTHON_VERSION_TOO_LOW",
          message: `检测到 ${found.path} 版本 ${found.version}，需要 3.12+。请安装 Python 3.12 或更高版本。`,
        };
      }
      return { ok: true, path: found.path, version: found.version };
    }
  }
  return {
    ok: false,
    code: "PYTHON_NOT_FOUND",
    message: "未检测到 Python 解释器。请安装 Python 3.12 或更高版本。",
  };
}
