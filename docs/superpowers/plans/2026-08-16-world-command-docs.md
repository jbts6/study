# 探索命令文档补齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让玩家在编辑器和报错里直接看到 6 种世界探索命令的正确格式，不再靠猜字段名。

**Architecture:** 不改命令协议。两处改动：`STARTER_CODE` 的 `choose_world_action` 注释补全命令菜谱；`validate-world-command.ts` 的校验报错附带格式示例和当前地点可用 id（复用 `validate-turn-command.ts` 已有的报错模式）。

**Tech Stack:** TypeScript + vitest，VS Code 扩展（npm run install:local 交付）。

## Global Constraints

- 字典命令形式、字段白名单、`expectedRevision` 机制一律不变。
- 本分支基于 `feat/player-fileset-reset`，`PLAYER_FILESET_VERSION` 保持 2，不触碰迁移代码。
- 设计文档：`docs/superpowers/specs/2026-08-16-world-command-docs-design.md`。
- 界面帮助行（原设计改动 3）已存在于 `rpg/src/app/render-world-app.ts:4-10` 的 `WORLD_HELP`，本计划不做。
- 不修改仓库根的 `python-rpg/python-marsh-01.py`（玩家实时文件，由迁移机制在运行时重置送达）。
- 测试原则：正常路径 + 一个关键失败路径，不为报错文案逐条加用例。

---

### Task 1: 校验报错附带格式示例

**Files:**
- Modify: `rpg/src/game/world/validate-world-command.ts`
- Test: `rpg/src/game/world/resolve-world-command.test.ts`

**Interfaces:**
- Consumes: `resolveWorldCommand(state, content, input)`（签名不变）、`validateWorldCommand` 现有结构。
- Produces: 报错文案变化，`WorldCommandError` 类型不变；无新增导出。

- [ ] **Step 1: 写失败测试**

在 `resolve-world-command.test.ts` 中：

1. 把 `rejects prototype-inherited type names` 用例（约 65 行）的断言改为：

```ts
        expect(result.errors).toEqual([
          { code: "INVALID_COMMAND", path: "type", message: "不支持的世界指令类型；可用：talk、inspect、collect、use、travel、prepareBattle" },
        ]);
```

2. 在该用例后新增（真实玩家踩过的坑：travel 误用 targetId）：

```ts
  it("tells the player the correct travel format when targetId is misused", () => {
    const state = createPythonWorldInitialState();
    const result = resolveWorldCommand(state, PYTHON_WORLD_CONTENT, {
      expectedRevision: state.revision,
      type: "travel",
      targetId: "old_foundry",
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.errors[0]?.code).toBe("UNKNOWN_FIELD");
      expect(result.errors[0]?.message).toContain("正确格式");
      expect(result.errors[0]?.message).toContain("locationId");
    }
  });
```

- [ ] **Step 2: 运行确认失败**

```bash
cd rpg && npx vitest run src/game/world/resolve-world-command.test.ts
```

预期：两条用例 FAIL（新用例报 message 不含 "正确格式"；旧用例报文案不匹配）。

- [ ] **Step 3: 实现**

在 `validate-world-command.ts` 的 `COMMAND_KEYS` 之后加：

```ts
const COMMAND_EXAMPLES: Record<keyof typeof COMMAND_KEYS, string> = {
  inspect: '{"expectedRevision": 修订号, "type": "inspect", "targetId": "目标id"}',
  talk: '{"expectedRevision": 修订号, "type": "talk", "targetId": "NPC id"}',
  collect: '{"expectedRevision": 修订号, "type": "collect", "targetId": "材料来源id"}',
  use: '{"expectedRevision": 修订号, "type": "use", "itemId": "物品id", "targetId": "目标id"}',
  travel: '{"expectedRevision": 修订号, "type": "travel", "locationId": "地点id"}',
  prepareBattle: '{"expectedRevision": 修订号, "type": "prepareBattle", "encounterId": "遭遇id"}',
};
```

改 4 处报错文案（行号为当前文件行号）：

1. 约 45 行，type 不合法：
   `"不支持的世界指令类型"` → `"不支持的世界指令类型；可用：talk、inspect、collect、use、travel、prepareBattle"`
2. 约 50-51 行，字段不符，把两个分支的 message 都改为拼接格式示例（`type` 变量此时已通过 `Object.hasOwn(COMMAND_KEYS, type)` 校验，可安全索引）：

```ts
    const example = COMMAND_EXAMPLES[type as keyof typeof COMMAND_KEYS];
    const suffix = `；${type} 的正确格式：${example}`;
    return { accepted: false, errors: [error(unknown === undefined ? "INVALID_COMMAND" : "UNKNOWN_FIELD", unknown ?? "", unknown === undefined ? `指令字段不完整${suffix}` : `指令包含未知字段 ${unknown}${suffix}`)] };
```

3. 约 64 行 TRAVEL_LOCKED：
   `"地点未连接或尚未解锁"` → `` `地点未连接或尚未解锁；当前可前往：${location.connectedLocationIds.join("、") || "无"}` ``
4. 约 79/83/89 行三类 INVALID_TARGET，分别追加当前地点可用 id：
   - talk：`` `NPC 不在当前地点；此处 NPC：${location.npcIds.join("、") || "无"}` ``
   - inspect：`` `对象不在当前地点；此处对象：${location.objectIds.join("、") || "无"}` ``
   - collect：`` `材料来源不在当前地点；此处材料来源：${location.itemSourceIds.join("、") || "无"}` ``

约 66 行 travelRequirements 未满足的报错保持原样（任务门信息，非格式问题）。

- [ ] **Step 4: 运行确认通过**

```bash
cd rpg && npx vitest run src/game/world/resolve-world-command.test.ts
```

预期：全部 PASS。再跑全量确认无其他用例断言旧文案：

```bash
cd rpg && npm test
```

预期：全绿。若有其他文件断言旧文案（先 `git grep -n "指令包含未知字段\|地点未连接或尚未解锁\|NPC 不在当前地点\|对象不在当前地点\|材料来源不在当前地点" -- rpg/src` 核对），同步更新断言。

- [ ] **Step 5: 提交**

```bash
git add rpg/src/game/world/validate-world-command.ts rpg/src/game/world/resolve-world-command.test.ts
git commit -m "feat: embed command format examples in world validation errors"
```

---

### Task 2: starter 注释补全命令菜谱

**Files:**
- Modify: `rpg/src/game/content/python/python-marsh-01.ts:7-14`（`STARTER_CODE` 的 `choose_world_action` 段）

**Interfaces:**
- Consumes: 无。
- Produces: `STARTER_CODE` 字符串内容变化；`PYTHON_MARSH_01.starterCode` 引用不变。现有断言（`world-campaign-controller.test.ts:201` 等）均为 `toContain`/正则计数，不受影响。

- [ ] **Step 1: 修改 STARTER_CODE**

只替换文件第 7-14 行（`export const STARTER_CODE = \`def choose_world_action...` 到该函数 `return` 字典的收尾 `    }`），从其后两个空行开始的 `def choose_turn` 及文件其余部分一律保持原样。旧内容：

```ts
export const STARTER_CODE = `def choose_world_action(world):
    # 探索阶段读取 location、npcs、objects 和 inventory。
    # quests 给出任务；revision 必须原样回传。
    return {
        "expectedRevision": world["revision"],
        "type": "talk",
        "targetId": "toma",
    }
```

新内容（注意这是 JS 模板字面量内的 Python 代码，不得出现反引号或 `${`；结尾不带闭合反引号，原字面量继续）：

```ts
export const STARTER_CODE = `def choose_world_action(world):
    # 探索阶段读取 location、npcs、objects 和 inventory。
    # quests 给出任务；revision 必须原样回传到 expectedRevision。
    # 命令是字典，type 决定其余字段，六种命令格式：
    # 交谈：{"type": "talk", "targetId": "toma"}
    # 调查：{"type": "inspect", "targetId": "weather_station"}
    # 收集：{"type": "collect", "targetId": "copper_wire_source"}
    # 移动：{"type": "travel", "locationId": "old_foundry"}  <- 是 locationId，不是 targetId
    # 使用：{"type": "use", "itemId": "copper_wire", "targetId": "relay"}
    # 备战：{"type": "prepareBattle", "encounterId": "marsh_guardian"}
    # 填什么 id 看 world["npcs"]、world["objects"]、world["availableTravel"]。
    return {
        "expectedRevision": world["revision"],
        "type": "talk",
        "targetId": "toma",
    }
```

（`choose_turn` 段与文件其余部分保持原样。）

- [ ] **Step 2: 运行测试确认无回归**

```bash
cd rpg && npm test
```

预期：全绿（现有 starter 断言均为包含式匹配）。

- [ ] **Step 3: 提交**

```bash
git add rpg/src/game/content/python/python-marsh-01.ts
git commit -m "feat: add world command cookbook to marsh-01 starter"
```

---

### Task 3: 交付扩展

**Files:**
- 无源码改动；产出 `rpg/dist/python-rpg.vsix` 并安装到本机。

- [ ] **Step 1: 构建并安装**

```bash
cd rpg && npm run install:local
```

预期：命令成功结束，输出包含 vsix 安装/替换信息。

- [ ] **Step 2: 提醒用户**

告知用户：重载 VS Code 窗口并重开游戏页面；由于叠在 `feat/player-fileset-reset` 上（版本 2 迁移），首次启动会重置 `python-rpg/` 目录为带新注释的模板（含弹出提示），玩家自建草稿会被替换。
