import { join } from "node:path";
import { getLevel, LEVEL_ORDER } from "../game/content/levels";
import type { LevelId } from "../game/content/types";
import type {
  WorkspaceDocument,
  WorkspaceHost,
} from "./platform-types";

const LEVEL_DIRECTORY = "python-rpg";

export function levelFilePath(workspaceRoot: string, levelId: LevelId): string {
  return join(workspaceRoot, LEVEL_DIRECTORY, `${levelId}.py`);
}

export class DocumentWorkspace {
  constructor(private readonly host: WorkspaceHost) {}

  async ensureLevelFiles(): Promise<void> {
    for (const levelId of LEVEL_ORDER) await this.ensureLevelFile(levelId);
  }

  async readLevelCode(levelId: LevelId): Promise<string> {
    const path = levelFilePath(this.host.workspaceRoot, levelId);
    const openDocument = this.host.getOpenDocument(path);
    if (openDocument !== undefined) return openDocument.getText();
    const document = await this.host.openTextDocument(path);
    return document.getText();
  }

  async openLevel(levelId: LevelId): Promise<WorkspaceDocument> {
    await this.ensureLevelFile(levelId);
    const document = await this.host.openTextDocument(levelFilePath(this.host.workspaceRoot, levelId));
    await this.host.showTextDocument(document, { viewColumn: 1 });
    return document;
  }

  private async ensureLevelFile(levelId: LevelId): Promise<void> {
    const path = levelFilePath(this.host.workspaceRoot, levelId);
    if (this.host.getOpenDocument(path) !== undefined) return;
    if (await this.host.fileSystem.exists(path)) return;
    await this.host.fileSystem.writeFile(path, getLevel(levelId).starterCode);
  }
}

export type { WorkspaceDocument, WorkspaceFileSystem, WorkspaceHost } from "./platform-types";
