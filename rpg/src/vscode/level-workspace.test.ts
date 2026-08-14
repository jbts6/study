import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { DocumentWorkspace, levelFilePath } from "./level-workspace";
import { GO_PROGRAM } from "../programs/go";
import { PYTHON_RPG_CAMPAIGN } from "../game/content/python/levels";
import type { CampaignDefinition } from "../programs/types";
import type {
  WorkspaceDocument,
  WorkspaceFileSystem,
  WorkspaceHost,
} from "./platform-types";

class MemoryFileSystem implements WorkspaceFileSystem {
  readonly files = new Map<string, string>();
  readonly writes: string[] = [];

  exists(path: string): boolean {
    return this.files.has(path);
  }

  readFile(path: string): string {
    const value = this.files.get(path);
    if (value === undefined) throw new Error(`missing file: ${path}`);
    return value;
  }

  writeFile(path: string, content: string): void {
    this.writes.push(path);
    this.files.set(path, content);
  }
}

class MemoryHost implements WorkspaceHost {
  readonly openDocuments = new Map<string, WorkspaceDocument>();
  readonly shown: Array<{ document: WorkspaceDocument; viewColumn: 1 }> = [];

  constructor(
    readonly workspaceRoot: string,
    readonly fileSystem: WorkspaceFileSystem,
  ) {}

  getOpenDocument(path: string): WorkspaceDocument | undefined {
    return this.openDocuments.get(path);
  }

  async openTextDocument(path: string): Promise<WorkspaceDocument> {
    const document: WorkspaceDocument = this.openDocuments.get(path) ?? {
      path,
      getText: () => this.fileSystem.readFile(path) as string,
    };
    this.openDocuments.set(path, document);
    return document;
  }

  async showTextDocument(document: WorkspaceDocument, options: { viewColumn: 1 }): Promise<void> {
    this.shown.push({ document, viewColumn: options.viewColumn });
  }
}

describe("DocumentWorkspace", () => {
  it("按战役程序约定生成玩家文件路径", () => {
    const campaign: CampaignDefinition = {
      id: "go-rpg",
      title: "Go RPG",
      program: GO_PROGRAM,
      levelOrder: [],
    };

    expect(levelFilePath("C:/work", campaign, "go-marsh-01"))
      .toBe(join("C:/work", "go-rpg", "go-marsh-01.go"));
  });

  it("creates only missing level files and reads unsaved open text first", async () => {
    const fileSystem = new MemoryFileSystem();
    const existingPath = levelFilePath("/workspace", PYTHON_RPG_CAMPAIGN, "python-marsh-01");
    fileSystem.files.set(existingPath, "existing saved code");
    const host = new MemoryHost("/workspace", fileSystem);
    const unsavedPath = levelFilePath("/workspace", PYTHON_RPG_CAMPAIGN, "python-marsh-02");
    fileSystem.files.set(unsavedPath, "starter on disk");
    host.openDocuments.set(unsavedPath, {
      path: unsavedPath,
      getText: () => "unsaved code",
    });
    const workspace = new DocumentWorkspace(host, PYTHON_RPG_CAMPAIGN);

    await workspace.ensureLevelFiles();

    expect(fileSystem.files.get(existingPath)).toBe("existing saved code");
    expect(fileSystem.writes).not.toContain(existingPath);
    expect(fileSystem.files.get(unsavedPath)).toBe("starter on disk");
    expect(fileSystem.writes).not.toContain(unsavedPath);
    await expect(workspace.readLevelCode("python-marsh-02")).resolves.toBe("unsaved code");
  });

  it("opens a level document in the first editor column", async () => {
    const fileSystem = new MemoryFileSystem();
    const host = new MemoryHost("/workspace", fileSystem);
    const workspace = new DocumentWorkspace(host, PYTHON_RPG_CAMPAIGN);
    await workspace.ensureLevelFiles();

    const document = await workspace.openLevel("python-marsh-01");

    expect(document.path).toBe(levelFilePath("/workspace", PYTHON_RPG_CAMPAIGN, "python-marsh-01"));
    expect(host.shown).toEqual([{ document, viewColumn: 1 }]);
  });
});
