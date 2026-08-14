import type { PlayerProgramDefinition } from "../types";

export const PYTHON_PROGRAM: PlayerProgramDefinition = {
  language: "python",
  workspaceDirectory: "python-rpg",
  sourceFileName: (levelId) => `${levelId}.py`,
  runEntrypointFileName: () => "main.py",
  editorLanguageId: "python",
  createRunFiles: (_levelId, source) => ({ "main.py": source }),
};
