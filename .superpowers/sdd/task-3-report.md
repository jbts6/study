# Task 3 实现报告

## 交付内容

- 注册 `python-marsh-01` 至 `python-marsh-03`，提供递减教学脚手架、固定敌方职责、奖励及初始战斗。
- 新增 `levels.ts`，集中提供六关固定顺序、前三关内容访问、下一关推导与内容引用校验。
- 存档升级为 `SaveDataV2`；V1、未知版本、未注册关卡及战斗 ID 与关卡不符时进入恢复流程。
- `AppController` 从关卡定义派生初始战斗、已解锁能力与结算；新增重试和进入下一关操作。
- 玩家和敌方指令都在调用 `resolveTurn` 前执行 `validateLevelCommand`；非关键目标未完成的内核胜利视为任务失败，不发奖励也不能推进。
- 入口移除单关创建函数与等待型敌方指令，改由控制器使用战役内容。

## 验证

- `npm test -- src/game/content/levels.test.ts src/app/save-store.test.ts src/app/app-controller.test.ts`：3 个测试文件、12 项测试通过。
- `npm run build`：`tsc --noEmit` 和 Vite 生产构建通过。

## 说明

- Vite 报告当前主包压缩后略超过 500 kB；未改变现有打包边界，属于非阻断提示。
