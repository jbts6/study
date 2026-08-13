import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-electron";

const extensionDevelopmentPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const extensionTestsPath = join(extensionDevelopmentPath, "dist", "extension-test.cjs");
const temporaryRoot = await mkdtemp(join(tmpdir(), "python-rpg-vscode-test-"));
const workspacePath = join(temporaryRoot, "workspace");
const userDataPath = join(temporaryRoot, "user-data");
const extensionsPath = join(temporaryRoot, "extensions");

try {
  await mkdir(workspacePath, { recursive: true });
  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [
      workspacePath,
      "--disable-extensions",
      `--user-data-dir=${userDataPath}`,
      `--extensions-dir=${extensionsPath}`,
      "--skip-welcome",
      "--skip-release-notes",
    ],
    extensionTestsEnv: { PYTHON_RPG_TEST_WORKSPACE: workspacePath },
  });
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
