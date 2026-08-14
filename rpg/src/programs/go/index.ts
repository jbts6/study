import type { PlayerProgramDefinition } from "../types";

export const GO_PROGRAM: PlayerProgramDefinition = {
  language: "go",
  workspaceDirectory: "go-rpg",
  sourceFileName: (levelId) => `${levelId}.go`,
  runEntrypointFileName: () => "strategy.go",
  editorLanguageId: "go",
  createRunFiles: (_levelId, source) => ({ "strategy.go": source }),
};
