# Python 交互课程内容补全 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Python 交互课程从单节垂直切片扩展为 18 节自包含课程，并以可运行、可测试的本地日志审计器结业。

**Architecture:** 保留现有浏览器页面、Node.js 本地服务和 CPython Runner。新增服务端内容契约校验模块和前端纯渲染模块；课程内容继续由 `lesson.json`、`starter.py`、`example.py`、`hidden_test.py` 四类文件组成。四个课程模块分别提交，最后用表驱动测试验证全部参考实现和起始代码。

**Tech Stack:** Node.js 24+ 内置模块、原生 HTML/CSS/JavaScript、CPython 3.12+ 标准库、`node:test`、Python `unittest`

## Global Constraints

- 课程面向已有前端或其他语言经验、但尚未系统学习 Python 的学习者。
- 课程固定为 18 节、4 个模块，预计学习时间 22～26 小时。
- Python 练习只使用标准库，不新增 npm 运行时依赖或 Python 第三方依赖。
- 所有练习提交一个 Python 文件；结业产物为单文件 `log_auditor.py`。
- 代码只在本机执行，不增加账号、云同步、遥测或远程执行。
- 所有公开教学文字必须经过 HTML 转义；不引入 Markdown 解析器和任意 HTML。
- `hidden_test.py` 只能留在服务端，不得出现在 `GET /api/course`。
- 自动化测试覆盖正常路径和一个关键失败路径，不扩展完整错误状态矩阵。
- 不修改 `rpg/`、`go/`、`rust/`；不运行全仓测试。
- 修改后的文件不得超过 400 行，函数不得超过 60 行；`app.js` 的新增渲染职责必须提取到独立模块，新增课程样式必须放入独立 CSS 文件。
- 设计依据：`docs/superpowers/specs/2026-08-19-python-interactive-course-content-design.md`。

---

## File Map

### 内容契约与目录加载

- Create: `python/interactive-course/server/content-contract.mjs`
  - 校验课节元数据、结构化正文和占位标记。
- Modify: `python/interactive-course/server/catalog.mjs`
  - 在读取代码文件前调用内容契约校验。
- Modify: `python/interactive-course/internal/course/content/course.json`
  - 保存 18 节的唯一顺序。
- Modify: `python/interactive-course/internal/course/content/lessons/python-functions-01/lesson.json`
  - 将现有函数课扩充为完整结构化课节。
- Create: `python/interactive-course/internal/course/content/lessons/<lesson-id>/{lesson.json,starter.py,example.py,hidden_test.py}`
  - 保存新增 17 节课程内容与行为验收。

### 页面与交互

- Create: `python/interactive-course/web/lesson-view.js`
  - 提供分组、解锁判断和安全 HTML 渲染纯函数。
- Create: `python/interactive-course/web/lesson-content.css`
  - 承载模块导航、概念分节、常见错误、提示和参考答案样式。
- Modify: `python/interactive-course/web/app.js`
  - 编排课程状态、导航、解锁和运行，不继续承载正文 HTML 细节。
- Modify: `python/interactive-course/web/index.html`
  - 加载新增样式，并提供锁定提示节点。

### 测试与文档

- Create: `python/interactive-course/test/content-contract.test.mjs`
  - 验证结构化课节契约和关键失败路径。
- Create: `python/interactive-course/test/lesson-view.test.mjs`
  - 验证安全渲染、模块分组和逐节解锁。
- Create: `python/interactive-course/test/content.test.mjs`
  - 表驱动验证课节顺序、内容完整性、参考实现和起始代码。
- Modify: `python/interactive-course/test/course-and-http.test.mjs`
  - 将目录断言更新为 18 节，同时保持公开接口和 Runner 契约。
- Modify: `learning/catalog.json`
  - 将 Python 代表课节改为新第一节。
- Modify: `learning/README.md`
  - 标明 Python 课程包含 18 节。
- Modify: `README.md`
  - 删除“单节垂直切片”描述，更新课程状态。
- Modify: `python/README.md`
  - 改为自包含课程说明、四模块目录和结业项目说明。

---

### Task 1: 建立结构化内容契约并升级现有函数课

**Files:**
- Create: `python/interactive-course/server/content-contract.mjs`
- Create: `python/interactive-course/test/content-contract.test.mjs`
- Modify: `python/interactive-course/server/catalog.mjs`
- Modify: `python/interactive-course/internal/course/content/lessons/python-functions-01/lesson.json`
- Modify: `python/interactive-course/test/course-and-http.test.mjs`

**Interfaces:**
- Consumes: `lesson.json` 解析后的普通对象和 `course.json` 中的 `entry.id`。
- Produces: `validateLessonMetadata(metadata, expectedId): object`；成功时返回原元数据，失败时抛出包含课节 ID 和字段名的 `Error`。
- Public lesson fields: 现有字段，加上 `module`、`order`、`concepts`、`commonMistakes`、`exercise`、`recap`。

- [ ] **Step 1: 写内容契约失败测试**

创建 `test/content-contract.test.mjs`。测试使用完整的最小合法元数据，并表驱动删除 `concepts`、清空 `exercise.steps`、破坏 `module.order`、加入占位标记，分别断言错误消息包含字段名。

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLessonMetadata } from '../server/content-contract.mjs';

function validLesson() {
  return {
    id: 'python-functions-01',
    track: 'python',
    stage: 'foundation',
    title: '用函数汇总日志',
    module: { id: 'reusable-programs', title: '可复用程序', order: 2 },
    order: 6,
    objectives: ['定义函数', '返回统计结果'],
    prerequisites: ['python-loops-01'],
    activityTypes: ['guided', 'rebuild'],
    sourceRefs: ['python-docs-functions'],
    estimatedMinutes: 75,
    explanation: '使用函数建立清晰的输入和输出边界。',
    exerciseGoal: '实现 summarize(lines)。',
    hints: ['先统计总数', '再统计错误数'],
    concepts: [{
      title: '函数边界',
      explanation: '函数把输入、处理和输出组织在一起。',
      analogy: '类似把前端数据转换封装为纯函数。',
      code: 'def summarize(lines):\n    return {"total": len(lines)}',
    }],
    commonMistakes: [{
      symptom: '函数没有返回值。',
      cause: '只计算了局部变量。',
      fix: '使用 return 返回统计字典。',
    }],
    exercise: {
      goal: '返回 total 和 errors。',
      steps: ['创建统计变量', '遍历并返回结果'],
      acceptance: ['空列表返回两个零', 'ERROR 行计入 errors'],
    },
    recap: ['函数需要明确输入与返回值', '统计函数会进入日志审计器'],
  };
}

test('accepts a complete structured lesson', () => {
  const metadata = validLesson();
  assert.equal(validateLessonMetadata(metadata, metadata.id), metadata);
});

test('rejects one representative incomplete lesson shape', () => {
  const metadata = validLesson();
  metadata.exercise.steps = [];
  assert.throws(
    () => validateLessonMetadata(metadata, metadata.id),
    /python-functions-01.*exercise\.steps/,
  );
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `cd python/interactive-course && node --test test/content-contract.test.mjs`

Expected: FAIL，提示 `server/content-contract.mjs` 不存在。

- [ ] **Step 3: 实现内容契约校验器**

`content-contract.mjs` 只导出一个公共函数。用小型内部函数分别校验文本、数组和对象，错误消息统一为 `课节 <id> 的 <field> 无效`。

```javascript
const REQUIRED_TEXT = [
  'id', 'track', 'stage', 'title', 'explanation', 'exerciseGoal',
];
const REQUIRED_LISTS = [
  'objectives', 'activityTypes', 'sourceRefs', 'hints', 'concepts',
  'commonMistakes', 'recap',
];
const PLACEHOLDER_WORDS = [
  'TO' + 'DO',
  'TB' + 'D',
  'FIX' + 'ME',
  '待补充',
  '稍后实现',
];
const PLACEHOLDER_PATTERN = new RegExp(PLACEHOLDER_WORDS.join('|'), 'i');

export function validateLessonMetadata(metadata, expectedId) {
  requireObject(metadata, expectedId, 'lesson');
  if (metadata.id !== expectedId) fail(expectedId, 'id');
  for (const field of REQUIRED_TEXT) requireText(metadata[field], expectedId, field);
  for (const field of REQUIRED_LISTS) requireList(metadata[field], expectedId, field);
  requirePositiveInteger(metadata.order, expectedId, 'order');
  validateModule(metadata.module, expectedId);
  metadata.concepts.forEach((value, index) => validateConcept(value, expectedId, index));
  metadata.commonMistakes.forEach(
    (value, index) => validateMistake(value, expectedId, index),
  );
  validateExercise(metadata.exercise, expectedId);
  if (PLACEHOLDER_PATTERN.test(JSON.stringify(metadata))) fail(expectedId, 'placeholder');
  return metadata;
}
```

内部校验规则：`module` 必须有非空 `id`、`title` 和正整数 `order`；`concepts[]` 必须有 `title`、`explanation`、`analogy`、`code`；`commonMistakes[]` 必须有 `symptom`、`cause`、`fix`；`exercise` 必须有非空 `goal`、`steps[]`、`acceptance[]`。

- [ ] **Step 4: 在目录加载时执行校验**

修改 `catalog.mjs`：导入 `validateLessonMetadata`，在 ID 一致性检查后执行校验，再读取三个代码文件。

```javascript
const metadata = validateLessonMetadata(
  readJson(path.join(lessonRoot, 'lesson.json')),
  entry.id,
);
```

- [ ] **Step 5: 把现有函数课升级为第 6 节完整内容**

保留 `id: "python-functions-01"` 和现有函数练习，设置模块为 `reusable-programs`、模块序号 2、课程序号 6、前置课节 `python-loops-01`。写入三个概念小节：函数边界、局部变量与返回值、字典结果；写入两个常见错误：遗漏 `return`、只判断整行等于 `ERROR`；练习验收必须覆盖空列表、普通行和包含 `ERROR` 的行。

`example.py` 的公开行为保持：

```python
def summarize(lines):
    return {
        "total": len(lines),
        "errors": sum("ERROR" in line for line in lines),
    }
```

- [ ] **Step 6: 运行限定测试并确认 GREEN**

Run: `cd python/interactive-course && node --test test/content-contract.test.mjs test/course-and-http.test.mjs`

Expected: PASS；当前公开课程仍只有 `python-functions-01`，且公开 JSON 不含 `hiddenTest`。

- [ ] **Step 7: 提交内容契约**

```bash
git add python/interactive-course/server/content-contract.mjs python/interactive-course/server/catalog.mjs python/interactive-course/test/content-contract.test.mjs python/interactive-course/test/course-and-http.test.mjs python/interactive-course/internal/course/content/lessons/python-functions-01/lesson.json
git commit -m "feat: 建立 Python 课节内容契约"
```

---

### Task 2: 渲染结构化正文并实现可浏览的逐节解锁

**Files:**
- Create: `python/interactive-course/web/lesson-view.js`
- Create: `python/interactive-course/web/lesson-content.css`
- Create: `python/interactive-course/test/lesson-view.test.mjs`
- Modify: `python/interactive-course/web/app.js`
- Modify: `python/interactive-course/web/index.html`

**Interfaces:**
- Consumes: 公开课节对象和进度对象中的 `practiced[]`。
- Produces: `groupLessons(lessons): Array<{ module, lessons }>`、`isLessonUnlocked(lessons, lessonId, practiced): boolean`、`renderLessonContent(lesson): string`。
- 解锁依据只使用隐藏测试通过后写入的 `practiced[]`；`mastered[]` 继续表示学习者手动记录的独立重建证据。

- [ ] **Step 1: 写纯渲染和解锁失败测试**

创建 `lesson-view.test.mjs`，覆盖正常渲染、HTML 转义、模块分组和一个关键锁定路径。

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupLessons,
  isLessonUnlocked,
  renderLessonContent,
} from '../web/lesson-view.js';

test('renders structured lesson copy and escapes authored text', () => {
  const html = renderLessonContent({
    title: '<img src=x onerror=alert(1)>',
    stage: 'foundation',
    order: 1,
    estimatedMinutes: 60,
    module: { id: 'expressions', title: 'Python 表达方式', order: 1 },
    objectives: ['格式化日志'],
    concepts: [{ title: 'f-string', explanation: '组合文本', analogy: '模板字符串', code: 'print("ok")' }],
    commonMistakes: [{ symptom: '引号不配对', cause: '字符串未结束', fix: '配对引号' }],
    exercise: { goal: '返回摘要', steps: ['实现函数'], acceptance: ['输出稳定'] },
    hints: ['先写函数签名'],
    exampleCode: 'def answer():\n    return 1',
    recap: ['会格式化日志'],
  });
  assert.match(html, /第 1 课/);
  assert.match(html, /<details/);
  assert.doesNotMatch(html, /<img src=/);
  assert.match(html, /&lt;img/);
});

test('unlocks only the first lesson and the lesson after a pass', () => {
  const lessons = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
  assert.equal(isLessonUnlocked(lessons, 'one', []), true);
  assert.equal(isLessonUnlocked(lessons, 'two', []), false);
  assert.equal(isLessonUnlocked(lessons, 'two', ['one']), true);
  assert.equal(isLessonUnlocked(lessons, 'three', ['one']), false);
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `cd python/interactive-course && node --test test/lesson-view.test.mjs`

Expected: FAIL，提示 `web/lesson-view.js` 不存在。

- [ ] **Step 3: 实现纯视图模块**

`lesson-view.js` 自带私有 `escapeHtml`、列表和内容分节辅助函数。`renderLessonContent` 输出语义化的 `section`、`pre/code` 和原生 `details/summary`，不得拼入未经转义的作者文本。

```javascript
export function groupLessons(lessons = []) {
  const groups = [];
  for (const lesson of lessons) {
    const last = groups.at(-1);
    if (!last || last.module.id !== lesson.module.id) {
      groups.push({ module: lesson.module, lessons: [lesson] });
    } else {
      last.lessons.push(lesson);
    }
  }
  return groups;
}

export function isLessonUnlocked(lessons, lessonId, practiced = []) {
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  return index === 0 || (index > 0 && practiced.includes(lessons[index - 1].id));
}

export function renderLessonContent(lesson) {
  return [
    renderHeading(lesson),
    renderObjectives(lesson.objectives),
    renderConcepts(lesson.concepts),
    renderMistakes(lesson.commonMistakes),
    renderExercise(lesson.exercise),
    renderHints(lesson.hints),
    renderReference(lesson.exampleCode),
    renderRecap(lesson.recap),
  ].join('');
}
```

- [ ] **Step 4: 让控制器只编排状态**

在 `app.js` 导入三个公共函数。`renderLessons()` 按模块创建标题和课节按钮；所有按钮都可选择，以便浏览正文。按钮的 `data-locked` 和状态文字由 `isLessonUnlocked` 决定。

`renderLessonCopy()` 在课程加载成功后只调用：

```javascript
this.elements.lessonCopy.innerHTML = renderLessonContent(this.activeLesson);
```

`renderWorkspace()` 使用以下规则：

```javascript
const lessons = this.course?.lessons ?? [];
const unlocked = Boolean(this.activeLesson) && isLessonUnlocked(
  lessons,
  this.activeLesson.id,
  this.progress.practiced,
);
const editable = unlocked && !this.running;
this.elements.editor.disabled = !editable;
this.elements.runButton.disabled = !editable;
this.elements.masteredCheck.disabled = !editable;
this.elements.lessonLock.hidden = unlocked || !this.activeLesson;
```

保持现有成功路径：Runner 返回 `passed` 时把当前 ID 加入 `practiced[]`，从而解锁下一节。不要把浏览课节本身写入 `practiced[]`。

- [ ] **Step 5: 增加锁定提示和独立样式文件**

在 `index.html` 的现有 `styles.css` 后加载 `lesson-content.css`。在编辑器操作区加入 `#lesson-lock`，默认 `hidden`，文案为“通过上一节后可运行本节；课程正文仍可提前阅读。”

新样式文件负责：模块标题、课节锁定状态、概念小节、类比、常见错误、练习步骤、原生展开控件和代码块。使用现有 CSS 变量，不新增一套颜色系统；触控目标不小于 40px，并为 `summary:focus-visible` 提供清晰轮廓。

- [ ] **Step 6: 运行限定测试并检查文件体积**

Run: `cd python/interactive-course && node --test test/lesson-view.test.mjs test/store.test.mjs`

Expected: PASS。

Run: `cd python/interactive-course && wc -l web/app.js web/lesson-view.js web/styles.css web/lesson-content.css`

Expected: 每个文件不超过 400 行；`app.js` 不因结构化正文增加大段 HTML。

- [ ] **Step 7: 提交页面能力**

```bash
git add python/interactive-course/web/app.js python/interactive-course/web/index.html python/interactive-course/web/lesson-view.js python/interactive-course/web/lesson-content.css python/interactive-course/test/lesson-view.test.mjs
git commit -m "feat: 展示结构化 Python 课节"
```

---

### Task 3: 补全模块一“Python 表达方式”

**Files:**
- Modify: `python/interactive-course/internal/course/content/course.json`
- Modify: `learning/catalog.json`
- Create: `python/interactive-course/test/content.test.mjs`
- Create: `python/interactive-course/internal/course/content/lessons/python-values-01/{lesson.json,starter.py,example.py,hidden_test.py}`
- Create: `python/interactive-course/internal/course/content/lessons/python-conditions-01/{lesson.json,starter.py,example.py,hidden_test.py}`
- Create: `python/interactive-course/internal/course/content/lessons/python-sequences-01/{lesson.json,starter.py,example.py,hidden_test.py}`
- Create: `python/interactive-course/internal/course/content/lessons/python-mappings-01/{lesson.json,starter.py,example.py,hidden_test.py}`
- Create: `python/interactive-course/internal/course/content/lessons/python-loops-01/{lesson.json,starter.py,example.py,hidden_test.py}`

**Interfaces:**
- Produces the first six catalog IDs in this order: `python-values-01`, `python-conditions-01`, `python-sequences-01`, `python-mappings-01`, `python-loops-01`, `python-functions-01`.
- `learning/catalog.json.tracks[0].representativeUnit` becomes `python-values-01`.
- Every `starter.py` defines the required callable and returns a syntactically valid but behaviorally wrong result, so the hidden test reports `test_failed` rather than a syntax failure.
- Five new lessons use `module: { "id": "python-expressions", "title": "Python 表达方式", "order": 1 }`, `sourceRefs: ["python-docs-tutorial-basics"]`, and each `prerequisites` points to the immediately previous lesson except lesson 1, which uses an empty list.

- [ ] **Step 1: 创建表驱动内容测试并确认现有目录失败**

`content.test.mjs` 使用 `loadCourse` 和 `createPythonRunner`。第一项测试断言当前预期 ID；第二项循环当前所有课节，断言参考实现为 `passed`、起始代码不为 `passed`、公开对象没有 `hiddenTest`。

```javascript
const expectedLessonIds = [
  'python-values-01',
  'python-conditions-01',
  'python-sequences-01',
  'python-mappings-01',
  'python-loops-01',
  'python-functions-01',
];

test('maps the implemented Python lessons in order', () => {
  const course = loadCourse(courseRoot).publicCourse();
  assert.deepEqual(course.lessons.map((lesson) => lesson.id), expectedLessonIds);
});

test('every implemented example passes and starter remains an exercise', async () => {
  const catalog = loadCourse(courseRoot);
  const runner = createPythonRunner({
    pythonCommand: process.env.PYTHON_COURSE_PYTHON_PATH || 'python',
  });
  for (const lesson of catalog.publicCourse().lessons) {
    const internal = catalog.lesson(lesson.id);
    const example = await runner.run({
      code: internal.exampleCode,
      hiddenTest: internal.hiddenTest,
    });
    assert.equal(example.status, 'passed', `${lesson.id}: ${example.stderr}`);
    const starter = await runner.run({
      code: internal.starterCode,
      hiddenTest: internal.hiddenTest,
    });
    assert.notEqual(starter.status, 'passed', lesson.id);
  }
});
```

Run: `cd python/interactive-course && node --test test/content.test.mjs`

Expected: FAIL，实际目录只有 `python-functions-01`。

- [ ] **Step 2: 创建五节课的结构化正文**

每节使用 Task 1 的完整字段。`concepts` 各 3 项、`commonMistakes` 各 2 项、`exercise.steps` 和 `exercise.acceptance` 各至少 2 项、`hints` 各 3 项。内容使用下表的确定主题，不引用外部教材才能理解的术语。

| ID | 标题 | 分钟 | 概念顺序 | 常见错误 |
|---|---|---:|---|---|
| `python-values-01` | 运行、变量与字符串 | 60 | 脚本顺序执行；变量绑定；f-string | 拼接非字符串；把变量名写进普通字符串 |
| `python-conditions-01` | 条件、比较与真值 | 60 | `if/elif/else`；比较运算；空值真值 | 分支顺序错误；使用 `=` 代替 `==` |
| `python-sequences-01` | 列表、元组与切片 | 70 | 可变与不可变序列；索引切片；复制与别名 | 越界索引；误以为赋值会复制列表 |
| `python-mappings-01` | 字典与集合 | 70 | 键值映射；安全取值；集合去重 | 直接访问缺失键；把不可哈希值作为集合元素 |
| `python-loops-01` | 循环、enumerate 与推导式 | 75 | 直接迭代；带序号迭代；简单推导式 | 修改正在遍历的列表；为复杂副作用使用推导式 |

- [ ] **Step 3: 创建五组可执行练习**

参考实现必须使用以下签名和行为；起始代码保留签名并返回错误的空值。隐藏测试至少覆盖表中的两个样例。

```python
# python-values-01
def format_summary(source, total, errors):
    return f"{source}: {errors}/{total} errors"

# python-conditions-01
def classify_level(line):
    if "ERROR" in line:
        return "error"
    if "WARN" in line:
        return "warning"
    return "info"

# python-sequences-01
def recent_entries(lines, limit=3):
    if limit <= 0:
        return []
    return list(lines[-limit:])

# python-mappings-01
def summarize_sources(entries):
    counts = {}
    for entry in entries:
        source = entry.get("source", "unknown")
        counts[source] = counts.get(source, 0) + 1
    return counts

# python-loops-01
def number_errors(lines):
    errors = [line for line in lines if "ERROR" in line]
    return [f"{index}. {line}" for index, line in enumerate(errors, start=1)]
```

隐藏验收样例：

| ID | 输入 | 预期 |
|---|---|---|
| `python-values-01` | `("worker", 5, 2)`；`("api", 0, 0)` | `worker: 2/5 errors`；`api: 0/0 errors` |
| `python-conditions-01` | ERROR、WARN、普通行；同时含 WARN/ERROR | error、warning、info；error 优先 |
| `python-sequences-01` | 五项取后三项；`limit=0` | 新列表后三项；空列表；原列表不变 |
| `python-mappings-01` | 重复 source；缺失 source | 正确计数；归入 `unknown` |
| `python-loops-01` | 两条错误夹在普通行中；无错误 | 只编号错误且从 1 开始；空列表 |

- [ ] **Step 4: 更新课程顺序和公共代表课节**

在 `course.json` 中按接口顺序登记五个新目录，再登记现有函数课。将 `learning/catalog.json` 的 Python `representativeUnit` 改为 `python-values-01`。

- [ ] **Step 5: 运行模块内容测试**

Run: `cd python/interactive-course && node --test test/content-contract.test.mjs test/content.test.mjs`

Expected: PASS；六份参考实现通过，六份起始代码不能通过。

- [ ] **Step 6: 提交模块一**

```bash
git add learning/catalog.json python/interactive-course/internal/course/content/course.json python/interactive-course/internal/course/content/lessons/python-values-01 python/interactive-course/internal/course/content/lessons/python-conditions-01 python/interactive-course/internal/course/content/lessons/python-sequences-01 python/interactive-course/internal/course/content/lessons/python-mappings-01 python/interactive-course/internal/course/content/lessons/python-loops-01 python/interactive-course/test/content.test.mjs
git commit -m "feat: 补全 Python 表达方式课程"
```

---

### Task 4: 补全模块二“可复用程序”

**Files:**
- Modify: `python/interactive-course/internal/course/content/course.json`
- Modify: `python/interactive-course/test/content.test.mjs`
- Create: `python/interactive-course/internal/course/content/lessons/python-parameters-01/{lesson.json,starter.py,example.py,hidden_test.py}`
- Create: `python/interactive-course/internal/course/content/lessons/python-dataclasses-01/{lesson.json,starter.py,example.py,hidden_test.py}`
- Create: `python/interactive-course/internal/course/content/lessons/python-modules-01/{lesson.json,starter.py,example.py,hidden_test.py}`

**Interfaces:**
- Appends IDs 7～9: `python-parameters-01`, `python-dataclasses-01`, `python-modules-01`。
- Existing ID 6 remains `python-functions-01`。
- Three new lessons use `module: { "id": "reusable-programs", "title": "可复用程序", "order": 2 }`, `sourceRefs: ["python-docs-functions-dataclasses-modules"]`, and sequential prerequisites starting with `python-functions-01`.

- [ ] **Step 1: 扩展预期 ID 并确认 RED**

在 `content.test.mjs` 的 `expectedLessonIds` 末尾加入三个 ID。

Run: `cd python/interactive-course && node --test test/content.test.mjs`

Expected: FAIL，实际目录缺少第 7～9 节。

- [ ] **Step 2: 创建三节结构化正文**

| ID | 标题 | 分钟 | 概念顺序 | 常见错误 |
|---|---|---:|---|---|
| `python-parameters-01` | 参数、返回值与作用域 | 75 | 位置与关键字参数；仅关键字参数；局部作用域 | 可变默认值；修改外部变量代替返回结果 |
| `python-dataclasses-01` | 类型提示与数据类 | 80 | 类型提示用途；`@dataclass`；不可变记录 | 把类型提示当运行时校验；共享可变字段 |
| `python-modules-01` | 模块、导入与标准库 | 70 | 模块边界；显式导入；`datetime` 标准库 | 通配符导入；模块名遮蔽标准库 |

每节保持 3 个概念、2 个常见错误、3 个提示和明确的日志审计器关联。

- [ ] **Step 3: 创建三组可执行练习**

```python
# python-parameters-01
def count_level(lines, level="ERROR", *, case_sensitive=False):
    needle = level if case_sensitive else level.casefold()
    return sum(
        needle in (line if case_sensitive else line.casefold())
        for line in lines
    )

# python-dataclasses-01
from dataclasses import dataclass

@dataclass(frozen=True)
class LogEntry:
    timestamp: str
    level: str
    message: str

def make_entry(timestamp, level, message):
    return LogEntry(timestamp, level.upper(), message.strip())

# python-modules-01
from datetime import datetime

def parse_timestamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))

def is_at_or_after(value, cutoff):
    return parse_timestamp(value) >= cutoff
```

隐藏测试覆盖：默认不区分大小写和 `case_sensitive=True`；数据类字段、冻结行为和清理结果；`Z` 时区解析、早于和等于截止时间。

- [ ] **Step 4: 更新课程目录并运行模块测试**

Run: `cd python/interactive-course && node --test test/content-contract.test.mjs test/content.test.mjs`

Expected: PASS；目录包含 9 节，所有参考实现通过。

- [ ] **Step 5: 提交模块二**

```bash
git add python/interactive-course/internal/course/content/course.json python/interactive-course/internal/course/content/lessons/python-parameters-01 python/interactive-course/internal/course/content/lessons/python-dataclasses-01 python/interactive-course/internal/course/content/lessons/python-modules-01 python/interactive-course/test/content.test.mjs
git commit -m "feat: 补全 Python 可复用程序课程"
```

---

### Task 5: 补全模块三“文件与可靠性”

**Files:**
- Modify: `python/interactive-course/internal/course/content/course.json`
- Modify: `python/interactive-course/test/content.test.mjs`
- Create: `python/interactive-course/internal/course/content/lessons/python-paths-01/{lesson.json,starter.py,example.py,hidden_test.py}`
- Create: `python/interactive-course/internal/course/content/lessons/python-log-parsing-01/{lesson.json,starter.py,example.py,hidden_test.py}`
- Create: `python/interactive-course/internal/course/content/lessons/python-json-csv-01/{lesson.json,starter.py,example.py,hidden_test.py}`
- Create: `python/interactive-course/internal/course/content/lessons/python-errors-01/{lesson.json,starter.py,example.py,hidden_test.py}`
- Create: `python/interactive-course/internal/course/content/lessons/python-unittest-01/{lesson.json,starter.py,example.py,hidden_test.py}`

**Interfaces:**
- Appends IDs 10～14 in file-processing order。
- File exercises accept `str | pathlib.Path` through `Path(value)` normalization。
- All authored files use UTF-8 and platform-neutral `pathlib` paths。
- Five lessons use `module: { "id": "files-reliability", "title": "文件与可靠性", "order": 3 }`, `sourceRefs: ["python-docs-pathlib-json-csv-unittest"]`, and sequential prerequisites starting with `python-modules-01`.

- [ ] **Step 1: 扩展预期 ID 并确认 RED**

加入：`python-paths-01`、`python-log-parsing-01`、`python-json-csv-01`、`python-errors-01`、`python-unittest-01`。

Run: `cd python/interactive-course && node --test test/content.test.mjs`

Expected: FAIL，实际目录缺少第 10～14 节。

- [ ] **Step 2: 创建五节结构化正文**

| ID | 标题 | 分钟 | 概念顺序 | 常见错误 |
|---|---|---:|---|---|
| `python-paths-01` | pathlib 与文本文件 | 80 | Path 对象；UTF-8 读写；上下文管理 | 手拼路径分隔符；遗漏编码 |
| `python-log-parsing-01` | 解析日志记录 | 85 | 清理文本；限制次数拆分；输入校验 | 无限制 split；吞掉坏记录 |
| `python-json-csv-01` | JSON 与 CSV | 85 | JSON 对象；CSV 行；稳定输出 | 手拼 JSON；CSV 缺少 newline 处理 |
| `python-errors-01` | 异常、校验与错误信息 | 80 | 预期异常；自定义异常；保留原因链 | 捕获所有异常；空 catch 后继续 |
| `python-unittest-01` | unittest、临时目录与调试 | 90 | Arrange/Act/Assert；TestCase；临时目录 | 测试依赖真实用户文件；只断言“不报错” |

- [ ] **Step 3: 创建五组可执行练习**

```python
# python-paths-01
from pathlib import Path

def read_lines(file_path):
    text = Path(file_path).read_text(encoding="utf-8")
    return [line.strip() for line in text.splitlines() if line.strip()]

# python-log-parsing-01
from dataclasses import dataclass

@dataclass(frozen=True)
class LogEntry:
    timestamp: str
    level: str
    message: str

def parse_line(line):
    parts = [part.strip() for part in line.split("|", maxsplit=2)]
    if len(parts) != 3 or not all(parts):
        raise ValueError("日志格式必须是 timestamp|level|message")
    return LogEntry(parts[0], parts[1].upper(), parts[2])

# python-json-csv-01
import csv
import json
from pathlib import Path

def save_summary(summary, json_path, csv_path):
    Path(json_path).write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    with Path(csv_path).open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["metric", "value"])
        writer.writerows(sorted(summary.items()))

# python-errors-01
from pathlib import Path

class LogLoadError(Exception):
    pass

def load_log(path):
    source = Path(path)
    try:
        lines = [line.strip() for line in source.read_text(encoding="utf-8").splitlines() if line.strip()]
    except FileNotFoundError as error:
        raise LogLoadError(f"找不到日志文件: {source}") from error
    if not lines:
        raise LogLoadError(f"日志文件为空: {source}")
    return lines

# python-unittest-01
import unittest

def count_errors(lines):
    return sum("ERROR" in line for line in lines)

class LogAuditTests(unittest.TestCase):
    def test_counts_errors(self):
        self.assertEqual(count_errors(["INFO ready", "ERROR disk"]), 1)

    def test_empty_input(self):
        self.assertEqual(count_errors([]), 0)
```

隐藏测试使用 `tempfile.TemporaryDirectory` 验证文件行为；JSON 按解析结果断言，CSV 按 `csv.reader` 断言，不依赖空格细节；异常课检查 `LogLoadError` 文案和 `__cause__`；测试课加载学习者的 `LogAuditTests`，要求至少两个通过的测试方法。

- [ ] **Step 4: 更新目录并运行模块测试**

Run: `cd python/interactive-course && node --test test/content-contract.test.mjs test/content.test.mjs`

Expected: PASS；目录包含 14 节，文件练习使用测试临时目录，不触碰仓库外用户文件。

- [ ] **Step 5: 提交模块三**

```bash
git add python/interactive-course/internal/course/content/course.json python/interactive-course/internal/course/content/lessons/python-paths-01 python/interactive-course/internal/course/content/lessons/python-log-parsing-01 python/interactive-course/internal/course/content/lessons/python-json-csv-01 python/interactive-course/internal/course/content/lessons/python-errors-01 python/interactive-course/internal/course/content/lessons/python-unittest-01 python/interactive-course/test/content.test.mjs
git commit -m "feat: 补全 Python 文件与可靠性课程"
```

---

### Task 6: 补全模块四“日志审计器”并闭合 18 节门禁

**Files:**
- Modify: `python/interactive-course/internal/course/content/course.json`
- Modify: `python/interactive-course/test/content.test.mjs`
- Modify: `python/interactive-course/test/course-and-http.test.mjs`
- Create: `python/interactive-course/internal/course/content/lessons/python-argparse-01/{lesson.json,starter.py,example.py,hidden_test.py}`
- Create: `python/interactive-course/internal/course/content/lessons/python-file-scan-01/{lesson.json,starter.py,example.py,hidden_test.py}`
- Create: `python/interactive-course/internal/course/content/lessons/python-reporting-01/{lesson.json,starter.py,example.py,hidden_test.py}`
- Create: `python/interactive-course/internal/course/content/lessons/python-log-auditor-01/{lesson.json,starter.py,example.py,hidden_test.py}`

**Interfaces:**
- Appends final IDs: `python-argparse-01`, `python-file-scan-01`, `python-reporting-01`, `python-log-auditor-01`。
- Four lessons use `module: { "id": "log-auditor", "title": "日志审计器", "order": 4 }`, `sourceRefs: ["python-docs-argparse-pathlib"]`, and sequential prerequisites starting with `python-unittest-01`.
- Final public functions: `build_parser()`、`collect_log_files(root)`、`parse_line(line): LogEntry`、`build_report(entries: Iterable[LogEntry])`、`write_reports(report, output_dir, output_format="both")`、`audit_logs(log_dir, output_dir, output_format="both")`、`main(argv=None): int`。
- Final report keys: `files`、`records`、`invalid`、`by_level`；outputs: `audit.json` and `audit.csv`。

- [ ] **Step 1: 把目录测试升级为最终 18 节并确认 RED**

在 `content.test.mjs` 追加四个 ID，并新增最终不变量：18 节、4 个模块、顺序 1～18、每节必填数组非空、作者文本不存在占位标记。

同时把 `course-and-http.test.mjs` 的公开目录断言从 1 节更新为 18 节，首尾分别为 `python-values-01` 和 `python-log-auditor-01`。

Run: `cd python/interactive-course && node --test test/content.test.mjs test/course-and-http.test.mjs`

Expected: FAIL，目录缺少最终四节。

- [ ] **Step 2: 创建四节结构化正文**

| ID | 标题 | 分钟 | 概念顺序 | 常见错误 |
|---|---|---:|---|---|
| `python-argparse-01` | argparse 命令行入口 | 80 | parser；位置参数；选项与 choices | 手写 argv 下标；帮助文字不说明默认值 |
| `python-file-scan-01` | 扫描目录与筛选文件 | 80 | 递归遍历；文件筛选；稳定排序 | 把目录当文件；依赖系统返回顺序 |
| `python-reporting-01` | 聚合统计与报告生成 | 90 | 累加器；按级别分组；双格式输出 | 在循环中反复写文件；输出顺序不稳定 |
| `python-log-auditor-01` | 集成、测试和交付 | 120 | 组合管线；退出码；端到端验证 | 主函数承担所有细节；失败后仍返回成功码 |

- [ ] **Step 3: 创建前三组项目构建练习**

```python
# python-argparse-01
import argparse

def build_parser():
    parser = argparse.ArgumentParser(description="审计本地日志目录")
    parser.add_argument("log_dir", help="包含 .log 文件的目录")
    parser.add_argument("--output", default="audit-output", help="报告输出目录")
    parser.add_argument("--format", choices=("json", "csv", "both"), default="both")
    return parser

# python-file-scan-01
from pathlib import Path

def collect_log_files(root):
    base = Path(root)
    return sorted(
        (path for path in base.rglob("*.log") if path.is_file()),
        key=lambda path: path.as_posix(),
    )

# python-reporting-01
import csv
import json
from dataclasses import dataclass
from pathlib import Path

@dataclass(frozen=True)
class LogEntry:
    timestamp: str
    level: str
    message: str

def build_report(entries):
    by_level = {}
    for entry in entries:
        level = entry.level.upper()
        by_level[level] = by_level.get(level, 0) + 1
    return {"records": len(entries), "by_level": dict(sorted(by_level.items()))}

def write_reports(report, output_dir, output_format="both"):
    target = Path(output_dir)
    target.mkdir(parents=True, exist_ok=True)
    if output_format in {"json", "both"}:
        (target / "audit.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    if output_format in {"csv", "both"}:
        with (target / "audit.csv").open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["level", "count"])
            writer.writerows(report["by_level"].items())
```

隐藏测试验证解析参数、递归扫描只返回 `.log` 文件且顺序稳定、报告对大小写级别归一化，并实际解析 JSON/CSV 输出。

- [ ] **Step 4: 创建最终日志审计器练习**

最终 `example.py` 组合前序能力，不复制无关教学分支。确定行为：

- 每条合法记录格式为 `timestamp|level|message`。
- 无法解析的非空行计入 `invalid`，其余记录计入 `records` 和 `by_level`。
- `files` 是扫描到的 `.log` 文件数。
- `audit_logs` 创建输出目录并生成 `audit.json`、`audit.csv`。
- `main(argv=None)` 使用 `build_parser`；成功打印摘要并返回 0；日志目录不存在时向 stderr 输出明确消息并返回 1。

```python
def audit_logs(log_dir, output_dir, output_format="both"):
    files = collect_log_files(log_dir)
    entries = []
    invalid = 0
    for file_path in files:
        for line in file_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                entries.append(parse_line(line))
            except ValueError:
                invalid += 1
    report = build_report(entries)
    report.update({"files": len(files), "invalid": invalid})
    write_reports(report, output_dir, output_format)
    return report

def main(argv=None):
    args = build_parser().parse_args(argv)
    source = Path(args.log_dir)
    if not source.is_dir():
        print(f"日志目录不存在: {source}", file=sys.stderr)
        return 1
    report = audit_logs(source, args.output, args.format)
    print(f"已审计 {report['files']} 个文件、{report['records']} 条记录")
    return 0
```

隐藏测试用 `TemporaryDirectory` 建立两个 `.log` 文件和一个应忽略的 `.txt` 文件，包含 INFO、WARN、ERROR 和一条坏记录。断言报告为 2 个文件、3 条合法记录、1 条坏记录，并验证两个报告文件。关键失败路径断言缺失目录返回 1 且不生成报告。

- [ ] **Step 5: 运行最终内容门禁**

Run: `cd python/interactive-course && node --test test/content-contract.test.mjs test/content.test.mjs test/course-and-http.test.mjs`

Expected: PASS；18 份参考实现通过，18 份起始代码均未直接通过，公开接口无隐藏测试。

- [ ] **Step 6: 提交模块四**

```bash
git add python/interactive-course/internal/course/content/course.json python/interactive-course/internal/course/content/lessons/python-argparse-01 python/interactive-course/internal/course/content/lessons/python-file-scan-01 python/interactive-course/internal/course/content/lessons/python-reporting-01 python/interactive-course/internal/course/content/lessons/python-log-auditor-01 python/interactive-course/test/content.test.mjs python/interactive-course/test/course-and-http.test.mjs
git commit -m "feat: 完成 Python 日志审计器课程"
```

---

### Task 7: 更新学习说明并完成限定验收

**Files:**
- Modify: `README.md`
- Modify: `learning/README.md`
- Modify: `python/README.md`

**Interfaces:**
- Documentation declares 18 Python lessons, four modules, desktop-browser scope, CPython 3.12+, Node.js 24+, no third-party runtime dependencies, and the local log-auditor capstone.
- Verification scope remains `python/interactive-course` only.

- [ ] **Step 1: 更新根目录和学习目录状态**

在 `README.md` 中把“当前主线，已提供首个可运行课节”改为“已完成 18 节自包含交互课程”，并删除“当前 Python 垂直切片包含一个代表课节”。在 `learning/README.md` 的课节统计中加入 Python 18 节。

- [ ] **Step 2: 重写 Python 课程范围和学习方式**

在 `python/README.md` 中：

- 把“一个代表课节”改为 18 节、四模块、22～26 小时。
- 列出四个模块和课节范围。
- 说明课程正文可独立完成，Helsinki MOOC 与 CS50P 只作为延伸资料。
- 说明所有标题可提前浏览，只有通过上一节后才能运行下一节。
- 说明第 15～18 节逐步完成单文件日志审计器。
- 保留现有启动、解释器配置、运行结果和本地进度故障排查。

- [ ] **Step 3: 运行 Python 课程阶段性全量测试**

Run: `cd python/interactive-course && npm test`

Expected: PASS；课程契约、内容、HTTP/Runner、本地存储和纯视图测试全部通过。

- [ ] **Step 4: 启动本地课程并检查公开目录**

Run: `cd python/interactive-course && npm start`

Expected: 仅监听 `127.0.0.1:8010`，终端显示课程地址。

打开 `http://127.0.0.1:8010/api/course`，验证：

- `lessons.length === 18`
- 第一节为 `python-values-01`
- 最后一节为 `python-log-auditor-01`
- 任意公开课节均不含 `hiddenTest`

- [ ] **Step 5: 完成桌面浏览器主流程验收**

使用 1280×800 桌面视口检查第 1、6、10、15、18 节：

- 模块导航、当前态、完成态和锁定态清晰。
- 长讲解、代码块、提示和参考实现没有横向溢出或遮挡。
- 键盘可以聚焦并展开提示、参考实现。
- 第 1 节正确答案通过后解锁第 2 节。
- 刷新后当前课节、草稿和通过状态恢复。
- 最终参考实现对测试日志目录生成 `audit.json` 与 `audit.csv`。

将桌面截图保存到 `python/interactive-course/artifacts/`，该目录只保留用于本次验收的关键截图，不为每节生成截图。

- [ ] **Step 6: 检查范围和空白错误**

Run: `git diff --check`

Expected: PASS。

Run: `git status --short`

Expected: 只有本任务文档和验收产物；没有 `rpg/`、`go/`、`rust/` 变更。

- [ ] **Step 7: 提交文档与验收产物**

```bash
git add README.md learning/README.md python/README.md python/interactive-course/artifacts
git commit -m "docs: 完成 Python 课程学习说明"
```

---

## Final Acceptance Checklist

- [ ] `course.json` 按确定顺序登记 18 节、4 个模块。
- [ ] 每节具备完整结构化正文和四个内容文件。
- [ ] 18 份参考实现全部通过，18 份起始代码均不能直接通过。
- [ ] 公开课程接口没有隐藏测试源码。
- [ ] 未解锁课节可阅读但不能编辑或运行。
- [ ] 通过当前课节后下一节解锁，刷新后进度恢复。
- [ ] 最终日志审计器生成 JSON 与 CSV 报告，并处理缺失目录失败路径。
- [ ] `cd python/interactive-course && npm test` 通过。
- [ ] 桌面浏览器五个代表课节完成视觉和交互验收。
- [ ] 根目录、学习目录和 Python README 与 18 节现状一致。
- [ ] 没有修改 Python RPG、Go 或 Rust 课程。
