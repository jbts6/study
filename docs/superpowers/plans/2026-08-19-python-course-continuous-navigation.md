# Python Course Continuous Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让桌面端课程目录在长页面滚动时保持可用，并在练习通过后提供无需返回顶部的显式“下一课”入口。

**Architecture:** 在 `lesson-view.js` 中增加两个无 DOM 依赖的纯函数：课程推进状态计算和滚动调整量计算。`CourseApp` 消费这些结果更新按钮、完成提示、课节切换和目录位置；CSS 只为现有桌面侧栏增加粘性滚动，不改变移动端信息架构。

**Tech Stack:** 浏览器原生 ES Modules、DOM API、CSS Grid/Sticky、Node.js `node:test`，无第三方运行时依赖。

## Global Constraints

- 仅修改 `python/interactive-course` 的 Web UI、对应测试和 Python 学习文档。
- 不修改课程内容、逐节解锁规则、进度数据结构或本地 Runner。
- 不自动切换课节；只有学习者点击按钮后才进入下一课。
- 720px 及以下保留现有横向课程目录。
- 不增加第三方运行时依赖，不修改 `rpg/`、`go/` 或 `rust/`。
- 当前工作树已有 `.superpowers/sdd/task-3-report.md` 和 `task-4-report.md` 的用户改动，不暂存、不回退。

---

### Task 1: 课程推进状态与下一课操作

**Files:**
- Modify: `python/interactive-course/web/lesson-view.js`
- Modify: `python/interactive-course/test/lesson-view.test.mjs`
- Modify: `python/interactive-course/web/index.html`
- Modify: `python/interactive-course/web/app.js`
- Modify: `python/interactive-course/web/styles.css`

**Interfaces:**
- Consumes: `lessons: Array<{ id: string, order?: number, title?: string }>`、`currentLessonId: string`、`practiced: string[]`。
- Produces: `getLessonProgression(lessons, currentLessonId, practiced): { status: 'pending' | 'next' | 'complete', nextLesson: object | null }`。
- Produces: `CourseApp.goToNextLesson()`，只在推进状态为 `next` 时保存草稿并调用现有课节选择路径。

- [ ] **Step 1: 写课程推进状态失败测试**

在 `lesson-view.test.mjs` 导入 `getLessonProgression`，增加以下测试：

```javascript
test('offers the next ordered lesson only after the current lesson passes', () => {
  const lessons = [
    { id: 'one', title: '第一课' },
    { id: 'two', title: '第二课' },
    { id: 'three', title: '第三课' },
  ];

  assert.deepEqual(getLessonProgression(lessons, 'one', []), {
    status: 'pending',
    nextLesson: null,
  });
  assert.deepEqual(getLessonProgression(lessons, 'one', ['one']), {
    status: 'next',
    nextLesson: lessons[1],
  });
  assert.deepEqual(getLessonProgression(lessons, 'three', ['three']), {
    status: 'complete',
    nextLesson: null,
  });
});

test('does not advance when the current lesson is missing from the catalog', () => {
  assert.deepEqual(getLessonProgression([{ id: 'one' }], 'missing', ['missing']), {
    status: 'pending',
    nextLesson: null,
  });
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `cd python/interactive-course && node --test test/lesson-view.test.mjs`

Expected: FAIL，原因是 `lesson-view.js` 尚未导出 `getLessonProgression`。

- [ ] **Step 3: 实现最小课程推进纯函数**

在 `lesson-view.js` 中增加：

```javascript
export function getLessonProgression(lessons, currentLessonId, practiced) {
  const lessonList = Array.isArray(lessons) ? lessons : [];
  const practicedIds = new Set(Array.isArray(practiced) ? practiced : []);
  const currentIndex = lessonList.findIndex((lesson) => lesson.id === currentLessonId);
  if (currentIndex < 0 || !practicedIds.has(currentLessonId)) {
    return { status: 'pending', nextLesson: null };
  }
  const nextLesson = lessonList[currentIndex + 1] ?? null;
  return nextLesson
    ? { status: 'next', nextLesson }
    : { status: 'complete', nextLesson: null };
}
```

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `cd python/interactive-course && node --test test/lesson-view.test.mjs`

Expected: PASS，5 个视图测试全部通过。

- [ ] **Step 5: 增加下一课与完成态 DOM**

在 `index.html` 的 `.actions` 内、锁定提示之前增加：

```html
<button id="next-lesson-button" class="next-lesson-button" type="button" hidden></button>
<p id="course-complete" class="course-complete" hidden>已完成全部 18 节</p>
```

在 `getElements()` 中查询这两个元素，并在 `bindEvents()` 中绑定：

```javascript
this.elements.nextLessonButton.addEventListener('click', () => this.goToNextLesson());
```

- [ ] **Step 6: 将纯状态映射到工作区**

在 `renderWorkspace()` 中调用 `getLessonProgression`：

```javascript
const progression = getLessonProgression(
  lessons,
  this.activeLesson?.id ?? '',
  this.progress.practiced,
);
const hasNextLesson = progression.status === 'next';
this.elements.nextLessonButton.hidden = !hasNextLesson;
this.elements.nextLessonButton.disabled = this.running || !hasNextLesson;
this.elements.nextLessonButton.textContent = hasNextLesson
  ? `下一课：第 ${progression.nextLesson.order} 课 · ${progression.nextLesson.title}`
  : '';
this.elements.courseComplete.hidden = progression.status !== 'complete';
```

新增方法：

```javascript
goToNextLesson() {
  const progression = getLessonProgression(
    this.course?.lessons ?? [],
    this.activeLesson?.id ?? '',
    this.progress.practiced,
  );
  if (this.running || progression.status !== 'next') return;
  this.saveDraft();
  this.selectLesson(progression.nextLesson);
}
```

更新 `selectLesson()`：渲染后用 `focus({ preventScroll: true })` 聚焦主内容，再调用 `scrollIntoView({ block: 'start' })`。保留现有草稿保存、当前课节持久化和结果清空逻辑。

- [ ] **Step 7: 样式化下一课与完成态**

在 `styles.css` 中让 `#run-button` 与 `.next-lesson-button` 共享 44px 高度、按钮反馈和禁用规则；下一课按钮使用现有表面色、强调色边框，不增加新 token。`.course-complete` 使用现有 `--success`，移动断点下让下一课按钮占满操作区宽度。

- [ ] **Step 8: 运行限定测试并提交**

Run: `cd python/interactive-course && node --test test/lesson-view.test.mjs test/store.test.mjs`

Expected: PASS，视图和持久化测试均通过。

```bash
git add python/interactive-course/web/lesson-view.js python/interactive-course/test/lesson-view.test.mjs python/interactive-course/web/index.html python/interactive-course/web/app.js python/interactive-course/web/styles.css
git commit -m "feat: 增加 Python 课程下一课入口"
```

---

### Task 2: 粘性课程目录与滚动位置保持

**Files:**
- Modify: `python/interactive-course/web/lesson-view.js`
- Modify: `python/interactive-course/test/lesson-view.test.mjs`
- Modify: `python/interactive-course/web/app.js`
- Modify: `python/interactive-course/web/styles.css`

**Interfaces:**
- Consumes: `{ top: number, bottom: number }` 形式的容器与活动项边界。
- Produces: `getScrollAdjustment(containerRect, itemRect): number`；负数向上、正数向下、0 表示活动项已经可见。
- `CourseApp.renderLessons()` 在重建目录前保存 `courseNav.scrollTop`，重建后恢复并仅按纯函数结果做最小调整。

- [ ] **Step 1: 写滚动调整失败测试**

在 `lesson-view.test.mjs` 导入 `getScrollAdjustment` 并增加：

```javascript
test('calculates only the scroll needed to reveal the active lesson', () => {
  const container = { top: 100, bottom: 700 };
  assert.equal(getScrollAdjustment(container, { top: 180, bottom: 260 }), 0);
  assert.equal(getScrollAdjustment(container, { top: 60, bottom: 140 }), -40);
  assert.equal(getScrollAdjustment(container, { top: 680, bottom: 760 }), 60);
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `cd python/interactive-course && node --test test/lesson-view.test.mjs`

Expected: FAIL，原因是尚未导出 `getScrollAdjustment`。

- [ ] **Step 3: 实现最小滚动计算函数**

在 `lesson-view.js` 增加：

```javascript
export function getScrollAdjustment(containerRect, itemRect) {
  if (itemRect.top < containerRect.top) return itemRect.top - containerRect.top;
  if (itemRect.bottom > containerRect.bottom) return itemRect.bottom - containerRect.bottom;
  return 0;
}
```

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `cd python/interactive-course && node --test test/lesson-view.test.mjs`

Expected: PASS，6 个视图测试全部通过。

- [ ] **Step 5: 保留目录位置并显示活动项**

在 `index.html` 的现有 `nav` 增加 `id="course-nav"`。`getElements()` 增加 `courseNav`。

`renderLessons()` 开始时记录 `const previousScrollTop = this.elements.courseNav.scrollTop;`，重建后先恢复，再调用新方法：

```javascript
revealActiveLesson() {
  const activeLink = this.elements.courseNav.querySelector('.lesson-link.is-active');
  if (!activeLink) return;
  const adjustment = getScrollAdjustment(
    this.elements.courseNav.getBoundingClientRect(),
    activeLink.getBoundingClientRect(),
  );
  this.elements.courseNav.scrollTop += adjustment;
}
```

这样运行练习、更新状态和切换课节都不会把目录重置到顶部；只有活动项超出目录可见区时才做最小滚动。

- [ ] **Step 6: 增加桌面粘性目录样式**

在 `styles.css` 的课程导航规则中增加：

```css
.course-layout > nav {
  position: sticky;
  top: 0;
  align-self: start;
  max-height: 100vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
```

在 `@media (max-width: 720px)` 中显式恢复：

```css
.course-layout > nav {
  position: static;
  max-height: none;
  overflow-y: visible;
  overscroll-behavior: auto;
  scrollbar-gutter: auto;
}
```

- [ ] **Step 7: 运行课程范围回归并检查文件体积**

Run: `cd python/interactive-course && npm test`

Expected: PASS，全部课程测试通过且 0 失败。

Run: `cd python/interactive-course && wc -l web/app.js web/lesson-view.js web/styles.css test/lesson-view.test.mjs`

Expected: 每个产品文件不超过 400 行；若 `app.js` 超过 400 行，先把目录滚动函数提取到聚焦的 `web/course-navigation.js` 再提交。

- [ ] **Step 8: 启动或复用本地服务进行主流程验收**

在 1280×800 桌面视口确认：滚动到练习工作区后目录仍可操作；目录滚动位置不会因练习结果刷新而重置；通过中间课节后出现下一课按钮；点击后新课标题进入视口；最后一课显示完成态。720px 以下确认目录仍为横向滚动。

- [ ] **Step 9: 检查范围并提交**

Run: `git diff --check`

Expected: PASS。

Run: `git status --short`

Expected: 本任务文件之外只保留既存的 `.superpowers/sdd/task-3-report.md` 与 `task-4-report.md` 用户改动，无 `rpg/`、`go/`、`rust/` 变更。

```bash
git add python/interactive-course/web/lesson-view.js python/interactive-course/test/lesson-view.test.mjs python/interactive-course/web/index.html python/interactive-course/web/app.js python/interactive-course/web/styles.css
git commit -m "feat: 保持 Python 课程目录可用"
```

---

## Final Acceptance Checklist

- [ ] 未通过当前课节时不显示下一课入口。
- [ ] 通过中间课节后显示准确的下一课编号和标题。
- [ ] 点击下一课后保存当前草稿、清空旧结果，并从新课标题开始。
- [ ] 最后一课通过后显示“已完成全部 18 节”。
- [ ] 桌面端目录粘性可达，内部滚动位置在状态刷新后保持。
- [ ] 活动课节只在超出目录可见区时做最小滚动。
- [ ] 720px 以下保留横向目录。
- [ ] `cd python/interactive-course && npm test` 通过。
- [ ] 无新依赖，无 `rpg/`、`go/`、`rust/` 变更。
