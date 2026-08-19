# 玩家关卡文件版本化重置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在关卡代码接口发生不兼容更新后，自动以当前模板重置工作区的 Python RPG 玩家文件，且不影响战役进度。

**Architecture:** `DocumentWorkspace` 负责删除并重建受它管理的 `python-rpg/` 目录，同时将已打开的关卡文档替换为新模板。`player-fileset-migration` 使用工作区状态比较模板版本，在扩展创建会话前调用该重置动作；成功后才写入版本标记。

**Tech Stack:** TypeScript、VS Code `workspace.fs` 与 `WorkspaceEdit`、Vitest。

## Global Constraints

- 仅服务本地单人 Python RPG，不为未复现的迁移场景增加兼容层。
- 不兼容模板版本仅重置 `python-rpg/` 玩家文件，保留 `WorkspaceWorldSaveStore` 的战役进度。
- 重置失败不得写入版本标记，也不得继续启动游戏。
- 全新工作区（`python-rpg/` 目录尚不存在）首次启动不得因重置失败而中断；此时重置等价于首次生成模板文件。VS Code 的 `workspace.fs.delete` 对不存在的路径抛 `FileNotFound`，删除前必须先检查目录存在。
- `python-rpg/` 目录整体重置，玩家在该目录内自建的非关卡文件同样会被删除；完成提示必须说明这一点。
- 修改扩展代码后，最终必须运行 `npm run install:local`。

---

### Task 1: 版本化玩家文件重置

**Files:**
- Create: `rpg/src/vscode/player-fileset-migration.ts`
- Create: `rpg/src/vscode/player-fileset-migration.test.ts`
- Modify: `rpg/src/vscode/platform-types.ts`
- Modify: `rpg/src/vscode/level-workspace.ts`
- Modify: `rpg/src/vscode/level-workspace.test.ts`

**Interfaces:**
- Consumes: `CampaignDefinition`, `WorkspaceState`, `DocumentWorkspace`。
- Produces: `PLAYER_FILESET_VERSION`、`playerFilesetVersionKey(campaignId)` 与 `ensureCurrentPlayerFiles(workspace, state, campaign)`。
- Extends: `WorkspaceFileSystem.deleteDirectory(path)` 与 `WorkspaceHost.replaceOpenDocument(path, content)`。

- [ ] **Step 1: 写入失败测试**

在 `player-fileset-migration.test.ts` 创建内存状态与可失败的 `DocumentWorkspace` 测试替身，先断言重置抛错时状态键未更新：

```ts
await expect(ensureCurrentPlayerFiles(workspace, state, PYTHON_RPG_CAMPAIGN))
  .rejects.toThrow("reset failed");
expect(state.get<number>(playerFilesetVersionKey("python-rpg"))).toBeUndefined();
```

在 `level-workspace.test.ts` 断言 `resetLevelFiles()` 在目录存在时删除玩家目录、写入每一关的 `starterCode`，并调用替换已打开文档的主机方法；另加一条用例断言目录不存在时不抛错且同样写入全部关卡模板（全新工作区首启场景）。

- [ ] **Step 2: 运行失败测试**

Run: `npx vitest run src/vscode/player-fileset-migration.test.ts src/vscode/level-workspace.test.ts`

Expected: FAIL，因为迁移模块、目录删除和打开文档替换接口尚不存在。

- [ ] **Step 3: 实现最小重置接口与迁移模块**

在 `platform-types.ts` 增加：

```ts
deleteDirectory(path: string): void | Promise<void>;
replaceOpenDocument(path: string, content: string): void | Promise<void>;
```

在 `DocumentWorkspace` 增加 `resetLevelFiles()`：目录存在时才调用 `deleteDirectory`（全新工作区目录不存在，跳过删除即等价于首次生成），随后对 `campaign.levelOrder` 逐一写入 `getLevel(levelId).starterCode` 并调用 `replaceOpenDocument`（文件未打开时宿主空操作），确保 `readLevelCode()` 在当前会话返回新模板：

```ts
async resetLevelFiles(): Promise<void> {
  const directory = join(this.host.workspaceRoot, this.campaign.program.workspaceDirectory);
  if (await this.host.fileSystem.exists(directory)) {
    await this.host.fileSystem.deleteDirectory(directory);
  }
  for (const levelId of this.campaign.levelOrder) {
    const starterCode = getLevel(levelId).starterCode;
    const path = levelFilePath(this.host.workspaceRoot, this.campaign, levelId);
    await this.host.fileSystem.writeFile(path, starterCode);
    await this.host.replaceOpenDocument(path, starterCode);
  }
}
```

创建 `player-fileset-migration.ts`：

```ts
export const PLAYER_FILESET_VERSION = 2;

export function playerFilesetVersionKey(campaignId: CampaignId): string {
  return `${campaignId}.player-fileset-version`;
}

export async function ensureCurrentPlayerFiles(
  workspace: DocumentWorkspace,
  state: WorkspaceState,
  campaign: CampaignDefinition,
): Promise<boolean> {
  const key = playerFilesetVersionKey(campaign.id);
  if (state.get<number>(key) === PLAYER_FILESET_VERSION) return false;
  await workspace.resetLevelFiles();
  await state.update(key, PLAYER_FILESET_VERSION);
  return true;
}
```

相应扩展内存文件系统与主机替身：删除目录前缀下所有文件，记录替换后的打开文档文本。

- [ ] **Step 4: 运行针对性测试**

Run: `npx vitest run src/vscode/player-fileset-migration.test.ts src/vscode/level-workspace.test.ts`

Expected: PASS，覆盖版本不匹配重置、当前版本不重置、重置失败不写版本标记，以及目录不存在时不抛错并生成全部模板。

- [ ] **Step 5: 提交文件重置模块**

```bash
git add rpg/src/vscode/platform-types.ts rpg/src/vscode/level-workspace.ts rpg/src/vscode/level-workspace.test.ts rpg/src/vscode/player-fileset-migration.ts rpg/src/vscode/player-fileset-migration.test.ts
git commit -m "feat: reset outdated player files"
```

### Task 2: 在扩展启动时应用迁移

**Files:**
- Modify: `rpg/src/vscode/extension.ts`

**Interfaces:**
- Consumes: `ensureCurrentPlayerFiles(workspace, workspaceState, campaign)`。
- Produces: 启动游戏前已与当前模板版本一致的 `DocumentWorkspace`。

- [ ] **Step 1: 接入 VS Code 主机与启动链路**

在 `createWorkspaceHost()` 中实现——`deleteDirectory` 加入现有 `fileSystem` 对象，`replaceOpenDocument` 加入宿主层级：

```ts
// fileSystem 对象内：
deleteDirectory: async (path) => {
  await vscode.workspace.fs.delete(vscode.Uri.file(path), { recursive: true, useTrash: false });
},
// 宿主层级：
replaceOpenDocument: async (path, content) => {
  const document = vscode.workspace.textDocuments.find((item) => samePath(item.uri.fsPath, path));
  if (document === undefined) return;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), content);
  if (!await vscode.workspace.applyEdit(edit)) throw new Error(`无法更新已打开的玩家文件：${path}`);
},
```

在 `createActiveGame()` 创建 `workspaceState` 后、`workspace.ensureLevelFiles()` 前调用。注意该插入点位于现有 `try/catch`（包住 `session.start()`，extension.ts 末段）之外，重置异常必须就地捕获、提示并中止启动；此时面板尚未创建，无需额外资源清理：

```ts
let reset = false;
if (campaign.id === "python-rpg") {
  try {
    reset = await ensureCurrentPlayerFiles(workspace, workspaceState, campaign);
  } catch (error) {
    await vscode.window.showErrorMessage(`重置练习代码失败：${errorMessage(error)}`);
    return undefined;
  }
}
await workspace.ensureLevelFiles();
if (reset) {
  await vscode.window.showInformationMessage(
    "练习代码已按当前版本重置，python-rpg/ 目录下原有文件（含自建草稿）已被新模板替换。",
  );
}
```

现有 `try/catch` 仍只负责 `session.start()` 的错误提示与资源释放，不承担重置异常处理。

- [ ] **Step 2: 运行扩展相关验证**

Run: `npm run typecheck && npx vitest run src/vscode/player-fileset-migration.test.ts src/vscode/level-workspace.test.ts`

Expected: PASS。

- [ ] **Step 3: 提交启动集成**

```bash
git add rpg/src/vscode/extension.ts
git commit -m "feat: migrate player files before game startup"
```

### Task 3: 构建、安装与人工验收

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: 已完成的扩展迁移链路。
- Produces: 本机安装的 `dist/python-rpg.vsix`。

- [ ] **Step 1: 运行完整构建和必要测试**

Run: `npm run build && npm test`

Expected: PASS。

- [ ] **Step 2: 安装本地扩展**

Run: `npm run install:local`

Expected: 重新构建、生成 `dist/python-rpg.vsix` 并以 `--force` 安装。

- [ ] **Step 3: 人工验收**

重载 VS Code 窗口，打开 Python RPG。已有旧 `python-rpg/python-marsh-01.py` 时，确认文件被替换为含 `choose_world_action` 和 `"type": "talk"` 的新模板；确认任务进度仍保持原状态。另在一个空文件夹的新工作区中打开 Python RPG，确认首启不报错并正常生成全部关卡模板。

- [ ] **Step 4: 提交最终验证记录**

```bash
git status --short
git add docs/superpowers/plans/2026-08-16-player-fileset-reset.md
git commit -m "chore: verify player fileset migration"
```

`git status --short` 仅用于确认没有遗漏的本计划相关文件；工作区常有无关的 `.helloagents/`、`.superpowers/` 会话状态改动，严禁 `git add -A` 一并提交。
