export type Language = "python" | "go" | "rust";

export type ImplementedLanguage = Exclude<Language, "rust">;

export type CampaignId = "python-rpg" | "go-rpg";

export type PlayerProgramDefinition = Readonly<{
  language: ImplementedLanguage;
  workspaceDirectory: string;
  sourceFileName(levelId: string): string;
  runEntrypointFileName(levelId: string): string;
  editorLanguageId: string;
  createRunFiles(levelId: string, source: string): Readonly<Record<string, string>>;
}>;

export type CampaignDefinition<LevelId extends string = string> = Readonly<{
  id: CampaignId;
  title: string;
  program: PlayerProgramDefinition;
  levelOrder: readonly LevelId[];
}>;
