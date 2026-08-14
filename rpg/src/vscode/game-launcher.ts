import * as vscode from "vscode";
import {
  GAME_LAUNCHER_ACTIONS,
  type GameLauncherAction,
} from "./game-launcher-model";

export class GameLauncher implements vscode.TreeDataProvider<GameLauncherAction> {
  constructor(private readonly actions: readonly GameLauncherAction[] = GAME_LAUNCHER_ACTIONS) {}

  getTreeItem(action: GameLauncherAction): vscode.TreeItem {
    const item = new vscode.TreeItem(
      action.label,
      vscode.TreeItemCollapsibleState.None,
    );
    item.description = action.description;
    item.tooltip = `${action.label}：${action.description}`;
    item.command = { command: action.command, title: action.label, arguments: [action.campaignId] };
    item.iconPath = new vscode.ThemeIcon("play-circle");
    return item;
  }

  getChildren(action?: GameLauncherAction): GameLauncherAction[] {
    return action === undefined ? [...this.actions] : [];
  }
}
