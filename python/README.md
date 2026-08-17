# Python 基础与自动化

这是多语言学习工坊的第一阶段。学习顺序、课程来源和各语言入口统一记录在 [`learning/`](../learning/)；当前可运行内容是一个独立于 RPG 的本地 Python 交互课程。

主线默认参考 [Helsinki Python Programming MOOC](https://programming-26.mooc.fi/)，适合按练习逐步建立基础。偏好视频讲解时，可用 [CS50P](https://cs50.harvard.edu/python/) 作为替代。仓库只保存能力映射、原创课节和来源链接，不复制外部课程全文。

## 当前范围

首版只有“用函数汇总日志”一个代表课节，用于验证课程契约、本机 CPython 执行、错误反馈和学习进度。它不是完整 Python 课程，也不复用 RPG 的战斗执行器。

页面支持：

- 阅读目标、讲解和参考示例；
- 编辑并运行本地 Python 代码；
- 查看测试失败、语法错误和运行时错误；
- 分别记录“练习通过”和“独立重建完成”；
- 在浏览器刷新后恢复当前草稿和进度。

## 环境要求

- Node.js `24.15.0`
- CPython `3.12+`

代码只在本机运行，服务只监听 `127.0.0.1`。

## 启动课程

```bash
cd python/interactive-course
npm start
```

打开 <http://127.0.0.1:8010>。

## 核心验证

```bash
cd python/interactive-course
npm test
```

平台回归测试固定为 2 个文件、5 个用例。课程目录另有 1 个 `unittest` 验收脚本和 1 个用例，因此本阶段测试代码总预算固定为 3 个文件、6 个用例。

