import { join } from "node:path";
import { getLevel } from "../game/content/levels";
import type { LevelId } from "../game/content/types";
import type { CampaignDefinition } from "../programs/types";
import type {
  WorkspaceDocument,
  WorkspaceHost,
} from "./platform-types";

export function levelFilePath(workspaceRoot: string, campaign: CampaignDefinition, levelId: string): string {
  return join(workspaceRoot, campaign.program.workspaceDirectory, campaign.program.sourceFileName(levelId));
}

export class DocumentWorkspace {
  constructor(
    private readonly host: WorkspaceHost,
    private readonly campaign: CampaignDefinition,
  ) {}

  async ensureLevelFiles(): Promise<void> {
    for (const levelId of this.campaign.levelOrder) await this.ensureLevelFile(levelId);
  }

  async readLevelCode(levelId: LevelId): Promise<string> {
    const path = levelFilePath(this.host.workspaceRoot, this.campaign, levelId);
    const openDocument = this.host.getOpenDocument(path);
    if (openDocument !== undefined) return openDocument.getText();
    const document = await this.host.openTextDocument(path);
    return document.getText();
  }

  async openLevel(levelId: LevelId): Promise<WorkspaceDocument> {
    await this.ensureLevelFile(levelId);
    const document = await this.host.openTextDocument(levelFilePath(this.host.workspaceRoot, this.campaign, levelId));
    await this.host.showTextDocument(document, { viewColumn: 1 });
    return document;
  }

  private async ensureLevelFile(levelId: LevelId): Promise<void> {
    const path = levelFilePath(this.host.workspaceRoot, this.campaign, levelId);
    if (this.host.getOpenDocument(path) !== undefined) return;
    if (await this.host.fileSystem.exists(path)) return;
    await this.host.fileSystem.writeFile(path, getLevel(levelId).starterCode);
  }
}

export type { WorkspaceDocument, WorkspaceFileSystem, WorkspaceHost } from "./platform-types";
