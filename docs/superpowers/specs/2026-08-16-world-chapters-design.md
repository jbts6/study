# 世界战役第二至第六章 + 探索自动推进 — 设计

日期：2026-08-16
分支：`feat/world-chapter-02`（基于 master）

## 问题与目标

- 世界战役只有第一章；python 的 2-6 关内容（战场、概念阶梯）在 VS Code
  流程中不可达。"教会 Python"的完整阶梯需要续写第二到第六章。
- 探索层教学价值接近零：一次运行只返回一条写死的字典，玩家从不需要写
  程序。战斗侧已用"一次运行自动打完"修复；探索层用同一模式修复——探索
  也自动推进，玩家编写调度器函数。

## 一、探索自动推进（探索即程序）

复用自动战斗的循环基建，扩展到探索模式：

1. 点一次运行后，`choose_world_action` 被连续调用：命令应用、世界状态
   更新后，以新 `world` 再次执行，直到——
   - 任务链走到 `enterBattle` 步骤（遭遇开始）：停止，反馈"遭遇开始，
     再次运行进入自动战斗"（探索与战斗各留一次中场思考点）；
   - 命令被链校验或世界校验拒绝：停在当前步骤，反馈错误；修代码再运行
     从当前步骤继续（探索状态持久化，无需重置）；
   - 步数上限（默认 30，常量）：防死循环，停止并提示。
2. 错误目标即拒绝（自动推进下"合法但不推进"会空转）：链校验对不匹配步
   骤的命令返回教学性错误（"当前步骤是 X，需要…"），玩家改调度逻辑。
3. 第一章整链迁移到同模式；`prepareBattle` 由链的 `enterBattle` 步骤
   触发。
4. starter 教实验回路：注释示例加入 `print(world["objects"])` 等，stdout
   已显示在反馈面板，建立"看数据→改代码"调试习惯。

玩家侧心智模型统一：一个文件、两个函数 = 一份完整冒险 AI。
`choose_world_action` 是探索调度器（读 quests/objects/inventory 分支派
发），`choose_turn` 是战斗策略。

## 二、地基：数据驱动章节

第一章的任务链与胜利结算硬编码在 `reduce-world.ts` /
`settle-encounter.ts`。泛化为章节内容声明：

```ts
type ChapterDefinition = {
  id: string;
  startLocationId: string;
  locationIds: readonly string[];
  encounterIds: readonly string[];
  questChain: readonly QuestStep[];        // 新增：探索任务链
  victory: {                               // 新增：胜利结算
    returnLocationId: string;
    setFlags: Record<string, WorldFlagValue>;
    nextChapterId?: string;
    campaignComplete?: boolean;
  };
};

type QuestStep = {
  stepId: string;
  accept: { type: "talk" | "inspect" | "collect" | "use" | "travel";
            targetId?: string; itemId?: string };
  effects: { flags?: Record<string, WorldFlagValue>; addClue?: string;
             addItem?: { itemId: string; amount: number };
             advanceTo: string; enterBattle?: string;
             switchChapter?: string };
};
```

- `reduce-world` 按当前章节的 `questChain` 匹配命令：步骤匹配且目标符
  合 → 应用效果推进；步骤匹配但目标不符 → 拒绝并附教学错误；命令合法
  但不属当前步骤 → 拒绝并附"当前步骤是 X"。
- 第一章迁移到同机制（行为不变，现有测试守护）。
- 章节切换：`effects.switchChapter` 更新 `chapterId`，激活新链与新
  starter 草稿（`codeDrafts` 已按 chapterId 键控，存档零迁移）。
- 能力注入：遭遇构建调 `injectUnlockedAbilities(levelId, initialBattle)`
  （`LEVEL_UNLOCKS` 现成），前序章节奖励技能带入后续战斗。
- 战场数值：世界遭遇侧允许覆写单位数值以强制概念（lurker 先例），每章
  实现时按引擎实测推演。

## 三、五章内容总览（全部设计；本次实现仅第二章）

| 章 | 新地点 | 探索任务链（调度器练习） | 战斗（概念强制点） |
|---|---|---|---|
| 2 毒沼岔路 | venom-fork | 读库存数量 if 二选一信标 → 备战 | marsh-02：腐化时限 + 危险格压力，需在自疗/避危/输出间 if 取舍 |
| 3 勘测印记 | survey-ridge | 遍历 objects 按 status 筛选信标 → 备战 | marsh-03：双 hunter + 先激活 scout-mark 再杀最后敌人，目标次序遍历 |
| 4 双重封锁 | lock-yard | 天气+库存双条件 and/or 二选一 → 备战 | marsh-04：护 relay+激活 seal+12 回合双敌，组合条件决策 |
| 5 裂隙节点 | rift-nodes | 两段式选择（先目标后动作），starter 建议拆辅助函数 | marsh-05：node-a/b+双敌+14 回合，三段逻辑自然拆函数 |
| 6 沼心封印 | marsh-heart | 综合热身（遍历+组合） | marsh-06：三敌+final-seal+18 回合终战，campaignComplete |

- 每章链 2-3 步：到达新地点（`switchChapter` + travel 解锁条件挂上一章
  `victory.setFlags`）→ 数据推导步（目标由 world 状态计算，错即拒）→
  `enterBattle`。
- 每章新地点从锈沼营地直连，`travelRequirements` 挂上一章完成旗标；地
  图累计增长（单机可接受）。
- 各章 starter 重写为调度器 + 战斗策略双函数注释（自动语境 + 章概念示
  例，含 print 实验提示）。

## 四、第二章详设（本次实现范围）

- **进入**：第一章 `victory.setFlags: { chapter_02_unlocked: true }`；
  营地 `travel venom-fork`（要求该旗标），`switchChapter` 切至
  `python-marsh-02`。
- **任务链**：
  1. `inspect 路标`（venom-fork 固定对象）→ addClue 铜线补给说明；
  2. 数据步：`world["inventory"]` 中 `copper_wire` 数量 ≥1 → inspect
     `signal-tower-a`，否则 `signal-tower-b`（阈值数值以实测手感为准；
     第一章结算后玩家库存状态决定）；正确塔 addClue 战斗情报并推进；
  3. `enterBattle: venom-guardian`（marsh-02 战场）。
- **战斗**：marsh-02 复用；数值推演待实测——若纯攻击可胜则加压（预选：
  relay 耐久调低 + 危险格伤害提高，迫使血量/危险格条件分支必要）。
  奖励 `pierce` 解锁（进第三章遭遇注入）。
- **starter（python-marsh-02）**：调度器示例（stepId 分支 + 库存读取）+
  战斗 if 取舍示例（血量低 → mend；危险格 → 移动/guard）。

## 五、测试

- 地基泛化：第一章全链回归（现有用例）+ 链步骤"匹配推进 / 目标不符拒
  绝 / 非当前步骤拒绝"三路径单测。
- 探索自动推进：一次 runCode 消费多步命令直到 enterBattle 停止；被拒
  即停、重跑从当前步骤继续；步数上限触发停止。
- 第二章：travel 解锁与 switchChapter、数据步正确/错误目标、遭遇进入、
  战斗数值强制点推演（自动模式下静态命令必须失败）。
- 交付照旧 `npm run install:local`。

## 非目标

- 不改 AppController（go 战役 / 浏览器六关阶梯路径）。
- 第三到六章的实现（内容已设计，作为后续模板）。
- 不加探索层的新命令类型（协议不变）。
- 不做任务链编辑器或外部内容格式（TS 内容文件即源头）。
