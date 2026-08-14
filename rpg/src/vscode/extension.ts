import { randomBytes } from "node:crypto";
import { dirname, normalize } from "node:path";
import * as vscode from "vscode";
import { AppController, createDefaultRunLimits } from "../app/app-controller";
import { detectPython } from "../runners/local/python-detector";
import { PythonRunProcess } from "../runners/local/python-process";
import type { RunnerDiagnostic } from "../runners/protocol/types";
import { DirectRunnerClient } from "./direct-runner-client";
import { GameLauncher } from "./game-launcher";
import { GameSession, type SessionDiagnostics } from "./game-session";
import { DocumentWorkspace, levelFilePath, type WorkspaceDocument, type WorkspaceHost } from "./level-workspace";
import type { ThemePreference, WebviewCommand } from "./messages";
import { WorkspaceSaveStore } from "./workspace-save-store";
import { PYTHON_RPG_CAMPAIGN } from "../game/content/python/levels";

const THEME_KEY = "python-rpg.theme";
const PANEL_TYPE = "pythonRpg.game";

export function activate(context: vscode.ExtensionContext): void {
  let activeGame: ActiveGame | undefined;
  let opening: Promise<ActiveGame | undefined> | undefined;

  const openGame = async (): Promise<ActiveGame | undefined> => {
    if (activeGame !== undefined) {
      activeGame.reveal();
      return activeGame;
    }
    if (opening !== undefined) return opening;
    opening = createActiveGame(context).then((game) => {
      activeGame = game;
      game?.onDispose(() => { activeGame = undefined; });
      return game;
    }).finally(() => { opening = undefined; });
    return opening;
  };

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("pythonRpg.launcher", new GameLauncher()),
    vscode.commands.registerCommand("pythonRpg.open", openGame),
    vscode.commands.registerCommand("pythonRpg.runTurn", async () => {
      const game = await openGame();
      await game?.runTurn();
    }),
    { dispose: () => activeGame?.dispose() },
  );
}

export function deactivate(): void {}

class ActiveGame {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly disposeListeners = new Set<() => void>();
  private disposed = false;

  constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly session: GameSession,
    private readonly runner: DirectRunnerClient,
    diagnostics: vscode.DiagnosticCollection,
  ) {
    this.disposables.push(
      panel.onDidDispose(() => this.dispose(true)),
      panel.webview.onDidReceiveMessage((message: unknown) => {
        if (isWebviewCommand(message)) void this.session.handle(message);
      }),
      diagnostics,
    );
  }

  reveal(): void {
    this.panel.reveal(vscode.ViewColumn.Two);
  }

  async runTurn(): Promise<void> {
    await this.session.handle({ type: "runTurn" });
  }

  onDispose(listener: () => void): void {
    this.disposeListeners.add(listener);
  }

  dispose(panelAlreadyDisposed = false): void {
    if (this.disposed) return;
    this.disposed = true;
    this.session.dispose();
    this.runner.close();
    for (const disposable of this.disposables) disposable.dispose();
    if (!panelAlreadyDisposed) this.panel.dispose();
    for (const listener of this.disposeListeners) listener();
    this.disposeListeners.clear();
  }
}

async function createActiveGame(context: vscode.ExtensionContext): Promise<ActiveGame | undefined> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder === undefined) {
    await vscode.window.showErrorMessage("Python RPG 需要一个已打开的工作区文件夹，用于保存六个关卡脚本。");
    return undefined;
  }

  const workspace = new DocumentWorkspace(createWorkspaceHost(workspaceFolder.uri));
  const saveStore = new WorkspaceSaveStore({
    get: (key) => context.workspaceState.get(key),
    update: async (key, value) => { await context.workspaceState.update(key, value); },
  });
  await workspace.ensureLevelFiles();
  const loaded = saveStore.load();
  await workspace.openLevel(loaded.ok && loaded.save !== null ? loaded.save.currentLevelId : "python-marsh-01");

  const panel = vscode.window.createWebviewPanel(
    PANEL_TYPE,
    "Python RPG 战场",
    { viewColumn: vscode.ViewColumn.Two, preserveFocus: false },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist")],
    },
  );
  const diagnostics = vscode.languages.createDiagnosticCollection("python-rpg");
  panel.webview.html = loadingHtml(panel.webview, context.extensionUri);
  const runner = createRunner(context);
  const controller = new AppController({ runner, saveStore, runLimits: createDefaultRunLimits() }, PYTHON_RPG_CAMPAIGN);
  const session = new GameSession({
    controller,
    workspace,
    diagnostics: createDiagnostics(diagnostics, workspaceFolder.uri.fsPath),
    postMessage: (message) => panel.webview.postMessage(message),
    getTheme: () => readTheme(context),
    setTheme: (theme) => context.workspaceState.update(THEME_KEY, theme),
  });
  const game = new ActiveGame(panel, session, runner, diagnostics);
  try {
    await session.start();
    panel.webview.html = webviewHtml(panel.webview, context.extensionUri);
    return game;
  } catch (error) {
    game.dispose();
    await vscode.window.showErrorMessage(`Python RPG 启动失败：${errorMessage(error)}`);
    return undefined;
  }
}

function createRunner(context: vscode.ExtensionContext): DirectRunnerClient {
  const script = vscode.Uri.joinPath(
    context.extensionUri,
    "src", "runners", "python", "runtime", "run_once.py",
  ).fsPath;
  return new DirectRunnerClient({
    detect: () => {
      const configured = vscode.workspace.getConfiguration("pythonRpg").get<string>("pythonPath", "").trim();
      return detectPython(configured ? { candidates: [configured] } : undefined);
    },
    createProcess: (request, pythonPath) => new PythonRunProcess({ pythonPath, script, request }),
  });
}

function createWorkspaceHost(root: vscode.Uri): WorkspaceHost {
  return {
    workspaceRoot: root.fsPath,
    fileSystem: {
      exists: async (filePath) => {
        try {
          await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
          return true;
        } catch (error) {
          if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") return false;
          throw error;
        }
      },
      readFile: async (filePath) => new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))),
      writeFile: async (filePath, content) => {
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirname(filePath)));
        await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), new TextEncoder().encode(content));
      },
    },
    getOpenDocument: (filePath) => wrapDocument(vscode.workspace.textDocuments.find((document) => samePath(document.uri.fsPath, filePath))),
    openTextDocument: async (filePath) => wrapDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(filePath)))!,
    showTextDocument: async (document) => {
      const textDocument = vscode.workspace.textDocuments.find((candidate) => samePath(candidate.uri.fsPath, document.path))
        ?? await vscode.workspace.openTextDocument(vscode.Uri.file(document.path));
      await vscode.window.showTextDocument(textDocument, { viewColumn: vscode.ViewColumn.One, preserveFocus: false });
    },
  };
}

function createDiagnostics(collection: vscode.DiagnosticCollection, workspaceRoot: string): SessionDiagnostics {
  return {
    clear: () => collection.clear(),
    replace: (levelId, values) => {
      const projected = values.flatMap((diagnostic) => toVsCodeDiagnostic(diagnostic));
      collection.set(vscode.Uri.file(levelFilePath(workspaceRoot, levelId)), projected);
    },
  };
}

function toVsCodeDiagnostic(value: RunnerDiagnostic): vscode.Diagnostic[] {
  const location = value.location;
  if (location === undefined || location.file !== "main.py") return [];
  const line = Math.max(0, location.line - 1);
  const column = Math.max(0, (location.column ?? 1) - 1);
  const start = new vscode.Position(line, column);
  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(start, start.translate(0, 1)),
    value.message,
    diagnosticSeverity(value.severity),
  );
  diagnostic.code = value.code;
  diagnostic.source = "Python RPG";
  return [diagnostic];
}

function diagnosticSeverity(value: RunnerDiagnostic["severity"]): vscode.DiagnosticSeverity {
  if (value === "error") return vscode.DiagnosticSeverity.Error;
  if (value === "warning") return vscode.DiagnosticSeverity.Warning;
  return vscode.DiagnosticSeverity.Information;
}

function wrapDocument(document: vscode.TextDocument | undefined): WorkspaceDocument | undefined {
  return document === undefined ? undefined : { path: document.uri.fsPath, getText: () => document.getText() };
}

function samePath(left: string, right: string): boolean {
  const normalizeForPlatform = (value: string) => process.platform === "win32" ? normalize(value).toLowerCase() : normalize(value);
  return normalizeForPlatform(left) === normalizeForPlatform(right);
}

function readTheme(context: vscode.ExtensionContext): ThemePreference {
  const value = context.workspaceState.get<unknown>(THEME_KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function webviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = randomBytes(16).toString("base64");
  const script = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "webview.js"));
  const style = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "webview.css"));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${style}">
  <title>Python RPG 战场</title>
</head>
<body>
  <main id="game-root" aria-label="Python RPG 战场"></main>
  <script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
}

function isWebviewCommand(value: unknown): value is WebviewCommand {
  if (value === null || typeof value !== "object" || !("type" in value)) return false;
  const record = value as Record<string, unknown>;
  if (record.type === "setTheme") return record.theme === "light" || record.theme === "dark" || record.theme === "system";
  return record.type === "ready" || record.type === "runTurn" || record.type === "interruptRun"
    || record.type === "retryLevel" || record.type === "advanceLevel" || record.type === "resetCampaign";
}

function loadingHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const style = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "webview.css"));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource};">
  <link rel="stylesheet" href="${style}">
  <title>Python RPG 战场</title>
</head>
<body>
  <main class="game-view recovery-view" aria-live="polite">
    <section class="recovery-panel">
      <p class="game-kicker">Python RPG</p>
      <h1>正在准备战场</h1>
      <p>正在恢复战役、创建关卡文件并检测本机 Python。</p>
    </section>
  </main>
</body>
</html>`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
