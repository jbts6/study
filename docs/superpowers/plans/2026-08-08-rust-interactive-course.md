# Rust Interactive Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Rust 的 12 章静态课程接入一个可运行、可提交、可解锁和可持久化的本地交互课程。

**Architecture:** `rust/interactive-course` 使用 Node.js 内置 HTTP 模块提供本地可信服务。课程目录将公开课节 DTO 与服务端隐藏测试分离；运行器为每次提交生成临时 Cargo lib 项目并执行 `cargo test`。原生 HTML/CSS/JavaScript 前端通过两个 API 获取课节和提交代码，使用 `localStorage` 保存学习状态。

**Tech Stack:** Node.js 24 built-ins, Rust stable 1.95+, Cargo, vanilla HTML/CSS/JavaScript, `node:test`; Playwright 只作为可选浏览器验收依赖。

## Global Constraints

- 运行器只用于本机可信代码，不接受公网部署或远程不可信代码。
- 代码输入上限 64 KiB，合并输出上限 32 KiB，单次执行超时 5 秒。
- `GET /api/course` 不得返回隐藏测试源码；`POST /api/execute` 必须由服务端按 `lessonId` 选择测试。
- 运行状态固定为 `passed`、`compile_error`、`test_failed`、`timeout`、`runner_unavailable`、`invalid_request`。
- TDD：新增生产逻辑必须先写一个会失败的测试并观察失败，再实现最小通过版本。
- 每个任务完成后运行其覆盖测试、`git diff --check`，并创建独立提交；不得改动现有 Go/Python/Rust 课程文件的既有内容。

---

### Task 1: Course Catalog And HTTP Contract

**Files:**
- Create: `rust/interactive-course/package.json`
- Create: `rust/interactive-course/server/model.mjs`
- Create: `rust/interactive-course/server/catalog.mjs`
- Create: `rust/interactive-course/server/http.mjs`
- Create: `rust/interactive-course/server/main.mjs`
- Create: `rust/interactive-course/internal/course/content/course.json`
- Create: `rust/interactive-course/internal/course/content/lessons/rust-start-00/lesson.json`
- Create: `rust/interactive-course/internal/course/content/lessons/rust-start-00/example.rs`
- Create: `rust/interactive-course/internal/course/content/lessons/rust-start-00/starter.rs`
- Create: `rust/interactive-course/internal/course/content/lessons/rust-start-00/hidden_test.rs`
- Test: `rust/interactive-course/test/catalog.test.mjs`
- Test: `rust/interactive-course/test/http.test.mjs`

**Interfaces:**
- `loadCatalog(contentRoot) -> Catalog` loads lesson metadata and code files. `Catalog.publicCourse()` returns only public fields, and `Catalog.lesson(id)` returns the internal lesson or `null`.
- `createHandler({ catalog, runner, staticRoot }) -> http.Server` handles `GET /api/course`, `POST /api/execute`, static files, 404 and method errors. The injected `runner.run({ code, hiddenTest, tests })` makes HTTP tests independent of Cargo.
- `PublicLesson` contains `id`, `title`, `goal`, `explanation`, `exampleCode`, `starterCode`, `exerciseGoal`, `hints`, and `tests`; it never contains `hiddenTest`.

- [ ] **Step 1: Write failing catalog tests** for unique lesson IDs, public DTO redaction, missing files, and the first lesson shape.
- [ ] **Step 2: Run `node --test test/catalog.test.mjs`** and verify it fails because the catalog modules do not exist.
- [ ] **Step 3: Write the minimal model, catalog loader, first lesson fixture, and package script.** Keep filesystem paths resolved from the module location rather than the process CWD.
- [ ] **Step 4: Write failing HTTP tests** for GET course, POST execute with an injected fake runner, invalid JSON, unknown lesson, and unsupported method.
- [ ] **Step 5: Run `node --test test/http.test.mjs`** and verify the new endpoint assertions fail before the handler exists.
- [ ] **Step 6: Implement `createHandler` and `main.mjs`.** Read JSON with a byte limit, select hidden tests from the catalog, and return normalized JSON errors.
- [ ] **Step 7: Run `node --test test/catalog.test.mjs test/http.test.mjs` and `git diff --check`.** Commit as `feat: add Rust course catalog and HTTP contract`.

### Task 2: Local Cargo Runner

**Files:**
- Create: `rust/interactive-course/server/runner.mjs`
- Create: `rust/interactive-course/server/output.mjs`
- Test: `rust/interactive-course/test/runner.test.mjs`
- Modify: `rust/interactive-course/server/http.mjs`
- Modify: `rust/interactive-course/server/main.mjs`

**Interfaces:**
- `validateCode(code, maxBytes) -> { ok: true } | { ok: false, message }` rejects empty input, NUL bytes and oversized UTF-8 input.
- `createCargoRunner(options).run({ code, hiddenTest, tests }) -> Promise<Result>` returns `{ status, stdout, stderr, diagnostics, tests }` and removes its temporary directory on every path.
- `parseCargoOutput(stdout, stderr, tests) -> Result` maps compiler failure, test failure, timeout and success without exposing temporary absolute paths.

- [ ] **Step 1: Write failing runner tests** for validation, a passing Rust function, a compile error, a failing hidden test, timeout, output truncation, and missing Cargo executable.
- [ ] **Step 2: Run `node --test test/runner.test.mjs`** and verify the tests fail for missing runner exports.
- [ ] **Step 3: Implement `validateCode`, temporary Cargo project generation, platform-aware Cargo command selection, bounded output collection, timeout termination, diagnostics cleanup, and status parsing.** Do not shell-interpolate user code.
- [ ] **Step 4: Inject the real runner in `main.mjs` and keep the HTTP handler injectable for tests.** Preserve the six-status API contract.
- [ ] **Step 5: Run `node --test test/runner.test.mjs test/http.test.mjs` and `git diff --check`.** Commit as `feat: add local Rust cargo runner`.

### Task 3: Browser Course Experience

**Files:**
- Create: `rust/interactive-course/web/index.html`
- Create: `rust/interactive-course/web/app.js`
- Create: `rust/interactive-course/web/store.js`
- Create: `rust/interactive-course/web/styles.css`
- Test: `rust/interactive-course/test/store.test.mjs`
- Test: `rust/interactive-course/test/app-contract.test.mjs`

**Interfaces:**
- `createStore(storage) -> { load, setCurrentLesson, togglePassed, getDraft, setDraft }` normalizes malformed state and continues with in-memory state when storage is unavailable.
- `createCourseApp({ document, fetch, store })` loads `/api/course`, renders navigation and the active lesson, posts `/api/execute`, and exposes `RustCourseApp` for smoke tests.
- DOM contract IDs: `courseNav`, `progressText`, `lessonMain`, `runButton`, `editor`, `output`, `lessonStatus`, and `storageNotice`.

- [ ] **Step 1: Write failing store tests** for default state, malformed saved state, current lesson, passed lesson toggling, and draft round-trip.
- [ ] **Step 2: Run `node --test test/store.test.mjs`** and verify it fails before `store.js` exists.
- [ ] **Step 3: Implement the normalized store with `localStorage` error handling.** Keep state serializable and avoid coupling it to DOM objects.
- [ ] **Step 4: Write failing app-contract tests** for API loading, navigation, disabled next lesson, run status, and required DOM IDs.
- [ ] **Step 5: Run `node --test test/app-contract.test.mjs`** and verify it fails before the app contract exists.
- [ ] **Step 6: Implement the responsive page.** Use a stable editor height, visible focus, keyboard-accessible controls, loading/empty/error/success states, and no nested decorative cards. Save drafts on input and passed state only after a `passed` response.
- [ ] **Step 7: Run all Node tests and `git diff --check`.** Commit as `feat: add Rust interactive course UI`.

### Task 4: Twelve Lessons, Documentation, And Acceptance

**Files:**
- Create: `rust/interactive-course/internal/course/content/lessons/rust-start-01` through `rust-start-11` with `lesson.json`, `example.rs`, `starter.rs`, and `hidden_test.rs`
- Create: `rust/interactive-course/README.md`
- Create: `rust/interactive-course/test/content.test.mjs`
- Modify: `rust/interactive-course/internal/course/content/course.json`
- Modify: `rust/interactive-course/package.json`
- Create: `rust/README.md`

**Interfaces:**
- Lesson IDs remain ordered `rust-start-00` through `rust-start-11` and map one-to-one to the existing Rust chapters.
- Every lesson has at least one public test label, one hidden test function, starter code that is intentionally incomplete, and example code that passes its hidden tests.
- README documents trusted local execution, `npm test`, `npm start`, `cargo` prerequisite, API boundaries, and the relationship to the existing Markdown course.

- [ ] **Step 1: Add content-contract tests** for exactly 12 lessons, chapter ordering, non-empty goals/examples/starters, hidden test separation, and unique test labels.
- [ ] **Step 2: Run `node --test test/content.test.mjs`** and verify it fails because only the first lesson exists.
- [ ] **Step 3: Add the remaining 11 lessons.** Cover variables/control flow, collections, structs/enums/Option, ownership, borrowing/slices, Result/errors, traits/iterators, threads/channels, async decision boundaries, modules/tests, and the task-board project model using standard-library-runnable APIs.
- [ ] **Step 4: Add README and deterministic verification commands.** Explain that the existing `course.md`, `roadmap.md`, and `project-tutorial.md` remain the deep-reading path.
- [ ] **Step 5: Run `npm test`, start the server, exercise one passing, compile-error, test-failure, and unknown-lesson request, and run the browser contract checks.** Commit as `docs: complete Rust interactive course lessons`.

### Final Review

- [ ] Run `npm test` from `rust/interactive-course` with a fresh process.
- [ ] Run `git diff --check` and inspect `git status --short` for unrelated-file changes.
- [ ] Verify `GET /api/course` does not contain `hiddenTest` or hidden test source text.
- [ ] Verify a passing lesson unlocks the next lesson after reload and that a saved draft returns after switching lessons.
- [ ] Update the SDD progress ledger and the active HelloAGENTS state file with commit hashes and verification evidence.
