import { describe, expect, it } from "vitest";
import { GAME_LAUNCHER_ACTIONS } from "./game-launcher-model";

describe("GAME_LAUNCHER_ACTIONS", () => {
  it("provides a clickable action that opens the game", () => {
    expect(GAME_LAUNCHER_ACTIONS).toEqual([
      {
        label: "打开游戏",
        description: "在当前窗口打开战场",
        command: "pythonRpg.open",
      },
    ]);
  });
});
