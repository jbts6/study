export type GameLauncherAction = Readonly<{
  label: string;
  description: string;
  command: string;
}>;

export const GAME_LAUNCHER_ACTIONS: readonly GameLauncherAction[] = [
  {
    label: "打开游戏",
    description: "在当前窗口打开战场",
    command: "pythonRpg.open",
  },
];
