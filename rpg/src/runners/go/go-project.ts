import { createHash } from "node:crypto";
import { access, chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CompiledRunRequest, JsonValue } from "../protocol/types";

const SDK_VERSION = "2";

export interface GoProject {
  readonly directory: string;
  readonly resultPath: string;
  readonly buildBinaryPath: string;
  readonly binaryPath: string;
  readonly cached: boolean;
  promoteBuild(): Promise<void>;
  cleanup(): Promise<void>;
}

export interface CreateGoProjectOptions {
  readonly request: CompiledRunRequest;
  readonly goVersion: string;
  readonly globalStoragePath: string;
  readonly runtimeDirectory?: string;
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export function createGoBuildCacheKey(
  source: string,
  sdkVersion: string,
  goVersion: string,
  platform: string,
  arch: string,
): string {
  return createHash("sha256")
    .update(source)
    .update(sdkVersion)
    .update(goVersion)
    .update(`${platform}/${arch}`)
    .digest("hex");
}

export async function createGoProject(options: CreateGoProjectOptions): Promise<GoProject> {
  const source = options.request.files[options.request.entrypoint.file];
  const runtimeDirectory = options.runtimeDirectory;
  if (runtimeDirectory === undefined) throw new Error("Go runtime 目录未配置。");
  const [sdk, runnerMain] = await Promise.all([
    readFile(path.join(runtimeDirectory, "sdk.go"), "utf8"),
    readFile(path.join(runtimeDirectory, "runner_main.go"), "utf8"),
  ]);
  const hash = createGoBuildCacheKey(
    source,
    SDK_VERSION,
    options.goVersion,
    process.platform,
    process.arch,
  );
  const cacheDirectory = path.join(options.globalStoragePath, "go-cache");
  const binaryName = `${hash}${process.platform === "win32" ? ".exe" : ""}`;
  const binaryPath = path.join(cacheDirectory, binaryName);
  const directory = await mkdtemp(path.join(tmpdir(), "python-rpg-go-"));
  const buildBinaryPath = path.join(directory, `strategy${process.platform === "win32" ? ".exe" : ""}`);
  const resultPath = path.join(directory, "result.json");

  try {
    await Promise.all([
      writeFile(path.join(directory, "go.mod"), "module local/python-rpg-strategy\n\ngo 1.22\n"),
      writeFile(path.join(directory, "strategy.go"), source),
      writeFile(path.join(directory, "sdk.go"), sdk),
      writeFile(path.join(directory, "runner_main.go"), runnerMain),
      writeFile(resultPath, ""),
    ]);
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }

  return {
    directory,
    resultPath,
    buildBinaryPath,
    binaryPath,
    cached: await exists(binaryPath),
    async promoteBuild(): Promise<void> {
      await mkdir(cacheDirectory, { recursive: true });
      await copyFile(buildBinaryPath, binaryPath);
      if (process.platform !== "win32") await chmod(binaryPath, 0o700);
    },
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

export async function readTurnResult(resultPath: string): Promise<JsonValue | undefined> {
  let contents: string;
  try {
    contents = await readFile(resultPath, "utf8");
  } catch {
    return undefined;
  }
  if (contents.trim().length === 0) return undefined;
  try {
    return JSON.parse(contents) as JsonValue;
  } catch {
    return undefined;
  }
}
