import { execFile } from "node:child_process";

export type GoDetection =
  | Readonly<{ ok: true; goPath: string; version: string }>
  | Readonly<{
    ok: false;
    code: "GO_NOT_FOUND" | "GO_VERSION_UNREADABLE";
    message: string;
    recoveryAction: string;
  }>;

export interface DetectGoOptions {
  readonly goPath?: string;
  readonly runVersion?: (goPath: string) => Promise<string>;
}

const GO_DOWNLOAD_URL = "https://go.dev/dl/";

function defaultRunVersion(goPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(goPath, ["version"], { encoding: "utf8", timeout: 2_000 }, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(`${stdout}\n${stderr}`.trim());
    });
  });
}

export async function detectGo(options: DetectGoOptions = {}): Promise<GoDetection> {
  const goPath = options.goPath ?? "go";
  let output: string;
  try {
    output = await (options.runVersion ?? defaultRunVersion)(goPath);
  } catch {
    return {
      ok: false,
      code: "GO_NOT_FOUND",
      message: "未检测到 Go 工具链。",
      recoveryAction: `安装 Go 后重新运行：${GO_DOWNLOAD_URL}`,
    };
  }

  const match = output.match(/\bgo version go(\d+\.\d+(?:\.\d+)?)\b/);
  if (!match) {
    return {
      ok: false,
      code: "GO_VERSION_UNREADABLE",
      message: `无法识别 Go 版本：${output || "无输出"}`,
      recoveryAction: `重新安装 Go 后重试：${GO_DOWNLOAD_URL}`,
    };
  }
  return { ok: true, goPath, version: match[1] };
}
