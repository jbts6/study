import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
import * as assert from "node:assert/strict";
import * as vscode from "vscode";

export async function run(): Promise<void> {
  const workspacePath = process.env.PYTHON_RPG_TEST_WORKSPACE;
  assert.ok(workspacePath, "Missing integration-test workspace path");

  const extension = vscode.extensions.getExtension("local.python-rpg");
  assert.ok(extension, "Python RPG extension was not discovered");
  await extension.activate();
  assert.ok((await vscode.commands.getCommands(true)).includes("pythonRpg.open"), "Open command was not registered");
  await vscode.commands.executeCommand("pythonRpg.open");
  try {
    await waitFor(() => hasExpectedTabs());
  } catch (error) {
    console.error(JSON.stringify(await diagnosticState(workspacePath), null, 2));
    throw error;
  }

  for (let index = 1; index <= 6; index += 1) {
    const levelId = `python-marsh-${String(index).padStart(2, "0")}`;
    await access(join(workspacePath, "python-rpg", `${levelId}.py`));
  }

  const firstGroup = vscode.window.tabGroups.all.find((group) => group.viewColumn === vscode.ViewColumn.One);
  const secondGroup = vscode.window.tabGroups.all.find((group) => group.viewColumn === vscode.ViewColumn.Two);
  assert.ok(firstGroup?.tabs.some((tab) => tab.input instanceof vscode.TabInputText
    && tab.input.uri.fsPath.endsWith(join("python-rpg", "python-marsh-01.py"))));
  assert.ok(secondGroup?.tabs.some((tab) => tab.input instanceof vscode.TabInputWebview
    && tab.input.viewType.endsWith("pythonRpg.game")));

  const levelDocument = vscode.workspace.textDocuments.find((document) =>
    document.uri.fsPath.endsWith(join("python-rpg", "python-marsh-01.py")));
  assert.ok(levelDocument, "First-level document was not opened");
  const edit = new vscode.WorkspaceEdit();
  edit.replace(
    levelDocument.uri,
    new vscode.Range(levelDocument.positionAt(0), levelDocument.positionAt(levelDocument.getText().length)),
    "def choose_turn(world)\n    return {}\n",
  );
  assert.equal(await vscode.workspace.applyEdit(edit), true);
  assert.equal(levelDocument.isDirty, true, "Integration test must exercise unsaved editor text");

  await vscode.commands.executeCommand("pythonRpg.runTurn");
  await waitFor(() => vscode.languages.getDiagnostics(levelDocument.uri)
    .some((diagnostic) => String(diagnostic.code) === "PYTHON_SYNTAX_ERROR"));
}

async function waitFor(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for Python RPG editor groups");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function hasExpectedTabs(): boolean {
  return vscode.window.tabGroups.all.some((group) => group.viewColumn === vscode.ViewColumn.One
    && group.tabs.some((tab) => tab.input instanceof vscode.TabInputText))
    && vscode.window.tabGroups.all.some((group) => group.viewColumn === vscode.ViewColumn.Two
      && group.tabs.some((tab) => tab.input instanceof vscode.TabInputWebview));
}

async function diagnosticState(workspacePath: string): Promise<unknown> {
  const levelDirectory = join(workspacePath, "python-rpg");
  let files: string[] = [];
  try {
    files = await readdir(levelDirectory);
  } catch {}
  return {
    workspaceFolders: vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath),
    levelFiles: files,
    textDocuments: vscode.workspace.textDocuments.map((document) => document.uri.fsPath),
    visibleEditors: vscode.window.visibleTextEditors.map((editor) => ({
      path: editor.document.uri.fsPath,
      viewColumn: editor.viewColumn,
    })),
    tabGroups: vscode.window.tabGroups.all.map((group) => ({
      viewColumn: group.viewColumn,
      tabs: group.tabs.map((tab) => ({
        label: tab.label,
        input: tabInputKind(tab.input),
        viewType: tab.input instanceof vscode.TabInputWebview ? tab.input.viewType : undefined,
      })),
    })),
  };
}

function tabInputKind(input: unknown): string {
  if (input instanceof vscode.TabInputText) return "text";
  if (input instanceof vscode.TabInputWebview) return "webview";
  return typeof input;
}
