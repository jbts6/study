# Python Local Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将本地 Python 课程入口替换为以 `Asabeneh/30-Days-Of-Python` 为主线的中文优先 30 天课程，并保留 Pyodide 运行代码、章节导航和本地进度。

**Architecture:** 使用 Node.js 同步脚本把个人本地上游仓库生成成被页面消费的 `lessons.js`，上游目录和生成文件均被 Git 忽略。课程页面拆成 HTML 骨架、样式、状态存储、Pyodide 执行器和页面编排模块；Markdown 通过固定版本的 `marked` 渲染并由 DOMPurify 清理。旧的 19 课页面先移动到 `legacy/` 备份，再使用新页面作为同一路径入口。

**Tech Stack:** Node.js 内置 `fs`/`path`/`child_process`/`node:test`、浏览器原生 DOM、Pyodide 0.26.2、marked 18.0.9、DOMPurify 3.4.13、本地 `python -m http.server`。

## Global Constraints

- 只修改 `python/` 和 `docs/superpowers/` 中本任务新增的文件；不得删除、覆盖或重排 `go/`、`rust/`、`.workbuddy/` 或其他用户已有改动。
- Asabeneh 上游目录 `python/upstream/` 与生成数据 `python/basics-course/generated/` 必须加入 `python/.gitignore`，不得提交到父仓库。
- 中文章节优先：`Chinese/{day}_{topic}_cn.md` 优先于 `Chinese/{day}_{topic}.md`，再回退到英文日课；第 1 天使用本地导入桥接内容并链接上游 Python 文件。
- 页面必须支持 30 天导航、可运行 Python 代码块、完成进度和刷新恢复；运行器失败必须展示中文错误，不能静默忽略。
- Pyodide 代码执行只在浏览器沙箱中进行；不增加本地 Python 代码执行后备路径。
- 同步脚本和前端普通源文件目标不超过 300 行；函数目标不超过 40 行；生成数据是例外。
- 每个任务先写测试或确定性检查，再写实现；任务完成运行聚焦验证和完整验证，并形成独立提交。

## Repository Layout

```text
python/
├── .gitignore
├── README.md
├── index.html
└── basics-course/
    ├── index.html
    ├── app.js
    ├── runner.js
    ├── store.js
    ├── styles.css
    ├── sync-course.mjs
    ├── sync-course.test.mjs
    ├── generated/lessons.js       # ignored, generated locally
    └── legacy/index.html          # old 19-lesson page
```

---

### Task 1: 上游同步与课程数据生成

**Files:**
- Create: `python/.gitignore`
- Create: `python/basics-course/sync-course.mjs`
- Create: `python/basics-course/sync-course.test.mjs`

**Interfaces:**
- `selectLessonFile(repoRoot, day): { sourcePath: string, language: "zh-CN" | "en", content: string }`
- `buildLessons(repoRoot): Array<{ id: string, day: number, title: string, content: string, sourcePath: string, sourceUrl: string }>`
- `writeGeneratedLessons(outputPath, lessons): void`
- CLI: `node python/basics-course/sync-course.mjs`

- [ ] **Step 1: 写同步逻辑的失败测试**

建立临时 fixture：包含 `Chinese/02_variables.md`、`Chinese/02_variables_cn.md`、`Chinese/03_operators.md`、英文 `03_Day_Operators/03_operators.md` 和 `01_Day_Introduction/helloworld.py`。测试必须验证：

```js
import assert from 'node:assert/strict';
import test from 'node:test';

test('中文 _cn 文件优先于普通中文文件', () => {
  const lesson = selectLessonFile(fixtureRoot, 2);
  assert.equal(lesson.sourcePath, 'Chinese/02_variables_cn.md');
  assert.equal(lesson.language, 'zh-CN');
});

test('中文缺失时回退到英文日课', () => {
  const lesson = selectLessonFile(fixtureRoot, 3);
  assert.equal(lesson.sourcePath, '03_Day_Operators/03_operators.md');
  assert.equal(lesson.language, 'en');
});

test('课程生成严格包含 30 天且按 day 排序', () => {
  const lessons = buildLessons(fixtureRoot);
  assert.equal(lessons.length, 30);
  assert.deepEqual(lessons.map((item) => item.day), Array.from({length: 30}, (_, i) => i + 1));
  assert.match(lessons[0].content, /Hello,? Python|Python/);
  assert.match(lessons[1].sourceUrl, /Asabeneh\/30-Days-Of-Python/);
});
```

- [ ] **Step 2: 运行测试确认 RED**

运行：`node --test python/basics-course/sync-course.test.mjs`

预期：失败，提示 `sync-course.mjs` 尚未导出 `selectLessonFile`、`buildLessons` 和 `writeGeneratedLessons`。

- [ ] **Step 3: 实现最小同步器**

在 `sync-course.mjs` 中：

1. 使用 `path.resolve` 固定上游目录为 `python/upstream/30-Days-Of-Python`，拒绝输出目录解析到 `python/` 之外。
2. 使用 `spawnSync` 的参数数组执行 `git clone --depth 1 --branch master https://github.com/Asabeneh/30-Days-Of-Python.git <target>`；目标已存在时执行 `git -C <target> pull --ff-only`。
3. 对第 2-30 天优先查找 `Chinese` 下带 `_cn` 后缀的 Markdown，再查找普通中文 Markdown，最后查找英文 `NN_Day_*` 目录中的 Markdown。
4. 第 1 天生成本地桥接 Markdown，正文说明课程入口、`print` 和执行方式，并在源信息中标明 `01_Day_Introduction/helloworld.py`。
5. 从 Markdown 首个一级/二级标题提取标题；没有标题时使用 `第 NN 天`。对每课输出 GitHub raw URL。
6. 用 `JSON.stringify` 生成 `window.PYTHON_COURSE = { source, lessons }`，写入 `generated/lessons.js`，不手写或拼接未转义字符串。
7. CLI 在同步或生成失败时以非零状态退出且保留原生成文件；成功时打印目录、语言覆盖数、30 天总数和输出文件。

- [ ] **Step 4: 运行测试确认 GREEN**

运行：`node --test python/basics-course/sync-course.test.mjs`。

预期：所有同步选择、排序、标题、来源链接和 JSON 生成测试通过。

- [ ] **Step 5: 运行真实上游同步并提交**

运行：`node python/basics-course/sync-course.mjs`。

预期：创建或更新 `python/upstream/30-Days-Of-Python`，生成 `python/basics-course/generated/lessons.js`，输出 `30 lessons`。

检查：`git status --short` 不显示 `python/upstream/` 或 `python/basics-course/generated/lessons.js`。

提交：`git add python/.gitignore python/basics-course/sync-course.mjs python/basics-course/sync-course.test.mjs && git commit -m "feat(python-course): add upstream course sync"`

---

### Task 2: 课程页面骨架、Markdown 渲染与进度状态

**Files:**
- Create: `python/index.html`
- Create: `python/basics-course/index.html`
- Create: `python/basics-course/app.js`
- Create: `python/basics-course/store.js`
- Create: `python/basics-course/styles.css`
- Move: `python/basics-course/index.html` to `python/basics-course/legacy/index.html` before creating the new entry

**Interfaces:**
- `loadCourseData(): CourseData`
- `renderLesson(lesson, state): void`
- `createStore(storage = localStorage): { load(), save(state), toggleComplete(day), setCurrentDay(day), getDraft(key), setDraft(key, value) }`
- `marked.parse(markdown)` followed by `DOMPurify.sanitize(html)`；不把用户代码直接拼进 HTML。

- [ ] **Step 1: 写页面契约检查**

创建 `python/basics-course/page-contract.test.mjs`，读取静态文件并断言：

```js
assert.match(html, /generated\/lessons\.js/);
assert.match(html, /pyodide\.js/);
assert.match(html, /marked@18\.0\.9/);
assert.match(html, /dompurify@3\.4\.13/);
assert.match(app, /PYTHON_COURSE/);
assert.match(app, /localStorage/);
```

- [ ] **Step 2: 运行契约检查确认 RED**

运行：`node --test python/basics-course/page-contract.test.mjs`

预期：因新页面和脚本不存在而失败。

- [ ] **Step 3: 实现页面和状态层**

1. 移动旧页面到 `python/basics-course/legacy/index.html`，创建新页面骨架；`python/index.html` 只做本地课程入口，链接到 `basics-course/index.html` 和 README。
2. 页面固定加载 Pyodide 0.26.2、marked 18.0.9、DOMPurify 3.4.13，并加载 `generated/lessons.js`、`store.js`、`runner.js`、`app.js`。
3. `store.js` 使用 `py-course-progress-v2`，读取失败回退 `{currentDay: 1, completed: [], drafts: {}}`；完成数组去重并限制在 1-30；所有写入异常显示可读状态但不阻塞页面。
4. `app.js` 从 `window.PYTHON_COURSE.lessons` 渲染 30 天导航；缺少生成数据时显示 `node basics-course/sync-course.mjs`；显示来源链接和 `trekhleb/learn-python`、`gregmalcolm/python_koans` 补充练习链接。
5. 使用 DOMPurify 清理 Markdown HTML；对 `pre code` 代码块创建带标题、编辑区、运行按钮和输出区的独立容器；只把 `language-python` 或无语言标记的块交给运行器，shell/json/html 块只读显示。
6. 代码块编辑草稿使用 `<day>:<blockIndex>` 保存，章节切换和刷新恢复；“标记完成”只更新当前天，不自动跳过未阅读章节。
7. `styles.css` 使用现有深色风格但拆成 token、布局、代码区、状态和移动媒体查询；桌面侧栏固定，移动端侧栏可展开，代码区宽度稳定，不使用大面积渐变和装饰图形。

- [ ] **Step 4: 运行契约检查确认 GREEN**

运行：`node --test python/basics-course/page-contract.test.mjs`。

预期：HTML、脚本依赖、课程数据入口和 localStorage 契约全部通过。

- [ ] **Step 5: 提交页面基础**

提交：`git add python/index.html python/basics-course/index.html python/basics-course/legacy/index.html python/basics-course/app.js python/basics-course/store.js python/basics-course/styles.css python/basics-course/page-contract.test.mjs && git commit -m "feat(python-course): add local 30-day course shell"`

---

### Task 3: Pyodide 运行器与交互状态

**Files:**
- Create: `python/basics-course/runner.js`
- Modify: `python/basics-course/app.js`
- Modify: `python/basics-course/styles.css`
- Modify: `python/basics-course/page-contract.test.mjs`

**Interfaces:**
- `createPythonRunner({ loadPyodide, document }): { init(), run(code), status }`
- `run(code): Promise<{ ok: boolean, output: string, error?: string }>`
- `app.js` 只依赖 runner 的 `init`、`run` 和状态回调，不直接调用 Pyodide 内部对象。

- [ ] **Step 1: 写运行器边界测试**

在 `runner.test.mjs` 中使用 fake Pyodide 测试：

```js
test('初始化加载状态和动态包', async () => {
  const fake = { loadPackagesFromImports: async () => {}, runPythonAsync: async () => 'ok' };
  const runner = createPythonRunner({ loadPyodide: async () => fake });
  await runner.init();
  const result = await runner.run('import math\nprint(math.sqrt(9))');
  assert.deepEqual(result, {ok: true, output: 'ok'});
});

test('运行异常返回可显示错误而不是抛出到页面', async () => {
  const fake = { loadPackagesFromImports: async () => {}, runPythonAsync: async () => { throw new Error('bad code'); } };
  const runner = createPythonRunner({ loadPyodide: async () => fake });
  await runner.init();
  assert.deepEqual(await runner.run('broken'), {ok: false, output: '', error: 'bad code'});
});
```

- [ ] **Step 2: 运行测试确认 RED**

运行：`node --test python/basics-course/runner.test.mjs`

预期：因 `runner.js` 尚未导出 `createPythonRunner` 而失败。

- [ ] **Step 3: 实现运行器**

1. `init()` 调用页面提供的 `loadPyodide`，状态依次为 `loading`、`ready` 或 `error`。
2. `run()` 未 ready 时返回中文“Python 运行时尚未就绪”；ready 后先调用 `loadPackagesFromImports(code)`，再以 `runPythonAsync` 执行包装后的 stdout 捕获代码。
3. 捕获的 stdout/stderr 合计限制 32 KiB；无输出返回 `（无输出）`；异常返回 traceback 的最后 20 行，保留 Python 文件/行号，去掉宿主路径。
4. 对 `requests`、真实文件路径、需要浏览器外部网络的代码返回原始 Python 异常并在页面显示“该示例需要本地 Python 环境”，不增加宿主机回退。
5. `app.js` 根据 runner 状态更新顶部圆点、运行按钮禁用态和输出区成功/错误类；运行中不能重复提交。

- [ ] **Step 4: 运行运行器和契约测试确认 GREEN**

运行：`node --test python/basics-course/runner.test.mjs python/basics-course/page-contract.test.mjs`。

预期：fake Pyodide 运行器、异常映射、依赖引用和页面状态契约通过。

- [ ] **Step 5: 提交运行器**

提交：`git add python/basics-course/runner.js python/basics-course/runner.test.mjs python/basics-course/app.js python/basics-course/styles.css python/basics-course/page-contract.test.mjs && git commit -m "feat(python-course): run lessons in pyodide"`

---

### Task 4: 文档、同步后启动和浏览器验收

**Files:**
- Create: `python/README.md`
- Modify: `python/basics-course/sync-course.mjs`
- Modify: `python/basics-course/app.js`
- Modify: `python/basics-course/styles.css`

**Interfaces:**
- 文档命令必须与实际目录一致：`cd python`、`node basics-course/sync-course.mjs`、`python -m http.server 8000`。
- 浏览器入口必须是 `http://127.0.0.1:8000/basics-course/`。

- [ ] **Step 1: 写文档和浏览器验收清单**

在 `python/README.md` 明确：个人本地上游目录不纳入父仓库、首次同步、更新同步、启动静态服务、打开入口、Pyodide 需要网络、未生成课程数据的修复命令，以及补充仓库链接。

验收清单固定为：

```text
桌面 1440x900：第 1 天加载、切换第 15/30 天、运行 Python 代码、标记完成、刷新恢复。
移动 390x844：打开菜单、切换章节、代码区不横向撑破、运行按钮可点击。
错误状态：删除 generated/lessons.js 后出现同步命令；断开 CDN 时出现运行时错误。
```

- [ ] **Step 2: 运行确定性检查**

运行：

```text
node --check python/basics-course/sync-course.mjs
node --check python/basics-course/app.js
node --check python/basics-course/runner.js
node --check python/basics-course/store.js
node --test python/basics-course/*.test.mjs
```

预期：脚本语法检查通过，所有 Node 测试通过。

- [ ] **Step 3: 启动静态服务进行浏览器验收**

在 `python/` 目录运行 `python -m http.server 8000 --bind 127.0.0.1`，使用浏览器检查桌面和移动视口；如果 8000 被占用，使用 8001。确认页面无控制台错误、课程数据 30 天完整、代码块运行输出、进度刷新恢复和错误提示可见。

- [ ] **Step 4: 运行差异和边界检查**

运行：`git diff --check`、`git status --short`、`git diff --stat HEAD`。

预期：没有空白错误；只出现计划内的 `python/` 与 `docs/superpowers/` 文件；`go/`、`rust/` 和其他用户改动不在差异中。

- [ ] **Step 5: 提交文档和验收修正**

提交：`git add python/README.md python/basics-course && git commit -m "docs(python-course): document local learning workflow"`

---

## Final Review and Delivery

所有任务完成后，主代理检查每个提交的文件范围和真实验证输出，重点确认：中文优先选择、30 天生成、上游/生成文件未进入 Git、旧课程已备份、Pyodide 无本地执行回退、进度恢复、桌面/移动布局无重叠。最终报告包含各提交短 SHA、课程入口、同步命令、验证命令及未运行或受网络影响的项目。
