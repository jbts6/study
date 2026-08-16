import { describe, expect, it } from "vitest";
import { getLevel } from "../levels";
import { enemyCommand } from "../../campaign/enemy-command";
import { validateLevelCommand } from "../../campaign/validate-level-command";
import { resolveTurn } from "../../combat/resolve-turn";
import type { BattleState, TurnCommand } from "../../combat/types";
import { PYTHON_WORLD_CONTENT } from "./world-chapter-01";

/**
 * 第二章遭遇的概念强制推演（数值调参依据）：
 * - 无条件追打 corruptor：relay 被腐化而败。
 * - 站桩输出但从不管 bog-wisp：被 wisp 每回合 3 点磨死。
 * - 站桩 + 读状态分支（wisp 贴脸先反击）：获胜。
 */
type Strategy = (state: BattleState) => TurnCommand;

function command(state: BattleState, action: TurnCommand["action"], movePath?: { x: number; y: number }[]): TurnCommand {
  return { actorId: "scout", expectedRevision: state.revision, ...(movePath === undefined ? {} : { movePath }), action };
}

function pathToward(state: BattleState, target: { x: number; y: number }): { x: number; y: number }[] {
  const scout = state.units.find((unit) => unit.id === "scout")!;
  const blocked = (cell: { x: number; y: number }) => state.units.some((unit) => unit.id !== "scout" && unit.cell.x === cell.x && unit.cell.y === cell.y);
  const distance = (cell: { x: number; y: number }) => Math.abs(cell.x - target.x) + Math.abs(cell.y - target.y);
  const start = { x: scout.cell.x, y: scout.cell.y };
  const steps = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dx, dy]) => ({ dx, dy }));
  let best: { x: number; y: number }[] | undefined;
  const consider = (path: { x: number; y: number }[]) => {
    if (!path.every((cell) => cell.x >= 0 && cell.y >= 0 && cell.x < state.board.width && cell.y < state.board.height && !blocked(cell))) return;
    if (best === undefined || distance(path[path.length - 1]!) < distance(best[best.length - 1]!)) best = path;
  };
  for (const first of steps) {
    const p1 = { x: start.x + first.dx, y: start.y + first.dy };
    consider([p1]);
    for (const second of steps) consider([p1, { x: p1.x + second.dx, y: p1.y + second.dy }]);
  }
  return best !== undefined && distance(best[best.length - 1]!) < distance(start) ? best : [];
}

function chaseCorruptor(state: BattleState): TurnCommand {
  const scout = state.units.find((unit) => unit.id === "scout")!;
  const corruptor = state.units.find((unit) => unit.id === "corruptor")!;
  const adjacent = Math.abs(scout.cell.x - corruptor.cell.x) + Math.abs(scout.cell.y - corruptor.cell.y) === 1;
  if (adjacent) return command(state, { type: "attack", targetId: "corruptor" });
  const movePath = pathToward(state, corruptor.cell);
  const endpoint = movePath[movePath.length - 1];
  const nextDistance = endpoint === undefined
    ? Math.abs(scout.cell.x - corruptor.cell.x) + Math.abs(scout.cell.y - corruptor.cell.y)
    : Math.abs(endpoint.x - corruptor.cell.x) + Math.abs(endpoint.y - corruptor.cell.y);
  return nextDistance === 1
    ? command(state, { type: "attack", targetId: "corruptor" }, movePath)
    : command(state, { type: "guard" }, movePath);
}

function holdAndBranch(focusWisp: boolean): Strategy {
  const blockCell = { x: 1, y: 2 };
  return (state) => {
    const scout = state.units.find((unit) => unit.id === "scout")!;
    if (scout.cell.x !== blockCell.x || scout.cell.y !== blockCell.y) {
      return command(state, { type: "guard" }, pathToward(state, blockCell));
    }
    const wisp = state.units.find((unit) => unit.id === "bog-wisp")!;
    if (focusWisp && !wisp.disabled) {
      const wispDistance = Math.abs(scout.cell.x - wisp.cell.x) + Math.abs(scout.cell.y - wisp.cell.y);
      if (wispDistance === 1) return command(state, { type: "attack", targetId: "bog-wisp" });
    }
    const corruptor = state.units.find((unit) => unit.id === "corruptor")!;
    const spark = scout.skills.find((skill) => skill.id === "spark")!;
    const corruptorDistance = Math.abs(scout.cell.x - corruptor.cell.x) + Math.abs(scout.cell.y - corruptor.cell.y);
    if (spark.remainingCooldown === 0 && corruptorDistance <= spark.range) {
      return command(state, { type: "cast", skillId: "spark", targetId: "corruptor" });
    }
    if (corruptorDistance === 1) return command(state, { type: "attack", targetId: "corruptor" });
    return command(state, { type: "guard" });
  };
}

function simulate(strategy: Strategy): Readonly<{ phase: BattleState["phase"]; round: number }> {
  const encounter = PYTHON_WORLD_CONTENT.encounters.venom_guardian!;
  const level = { ...getLevel("python-marsh-02"), enemyBehaviors: { ...getLevel("python-marsh-02").enemyBehaviors, ...encounter.enemyBehaviors } };
  let state = structuredClone(encounter.initialBattle);
  for (let safety = 0; safety < 40 && state.phase === "in_progress"; safety += 1) {
    const active = state.units.find((unit) => unit.id === state.turnOrder[state.turnIndex]);
    if (active === undefined) break;
    if (active.team === "allies") {
      const validation = validateLevelCommand(level, state, strategy(state));
      if (!validation.accepted) return { phase: "lost", round: state.round };
      const resolution = resolveTurn(state, validation.command);
      if (!resolution.accepted) return { phase: "lost", round: state.round };
      state = resolution.state;
    } else {
      const enemy = enemyCommand(level, state);
      const validation = validateLevelCommand(level, state, enemy);
      if (!validation.accepted) break;
      const resolution = resolveTurn(state, validation.command);
      if (!resolution.accepted) break;
      state = resolution.state;
    }
  }
  return { phase: state.phase, round: state.round };
}

describe("venom guardian encounter enforcement", () => {
  it("loses to the relay timer when chasing without holding the corridor", () => {
    expect(simulate(chaseCorruptor).phase).toBe("lost");
  });

  it("loses to bog-wisp chip damage when never branching on the wisp", () => {
    expect(simulate(holdAndBranch(false)).phase).toBe("lost");
  });

  it("wins by holding the corridor and branching on the adjacent wisp", () => {
    const outcome = simulate(holdAndBranch(true));
    expect(outcome.phase).toBe("won");
    expect(outcome.round).toBeLessThanOrEqual(8);
  });
});
