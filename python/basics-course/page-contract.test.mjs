import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const courseRoot = resolve('python');
const basicsRoot = resolve(courseRoot, 'basics-course');

function readIfPresent(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

const html = readIfPresent(resolve(basicsRoot, 'index.html'));
const app = readIfPresent(resolve(basicsRoot, 'app.js'));
const store = readIfPresent(resolve(basicsRoot, 'store.js'));
const styles = readIfPresent(resolve(basicsRoot, 'styles.css'));
const entry = readIfPresent(resolve(courseRoot, 'index.html'));

test('课程页面固定加载本地数据与版本化浏览器依赖', () => {
  assert.match(html, /generated\/lessons\.js/);
  assert.match(html, /pyodide\.js/);
  assert.match(html, /marked@18\.0\.9/);
  assert.match(html, /dompurify@3\.4\.13/);
  assert.match(html, /runner\.js/);
  assert.match(html, /runner-adapter\.js/);
  assert.match(html, /store\.js/);
  assert.match(html, /app\.js/);
});

test('运行器适配器在页面编排脚本之前加载', () => {
  const runnerPosition = html.indexOf('runner.js');
  const adapterPosition = html.indexOf('runner-adapter.js');
  const appPosition = html.indexOf('app.js');
  assert.ok(runnerPosition >= 0 && runnerPosition < adapterPosition);
  assert.ok(adapterPosition < appPosition);
});

test('页面编排使用课程数据、Markdown 清理和本地进度', () => {
  assert.match(app, /PYTHON_COURSE/);
  assert.match(app, /marked\.parse/);
  assert.match(app, /DOMPurify\.sanitize/);
  assert.match(app, /localStorage/);
  assert.match(app, /basics-course\/sync-course\.mjs/);
  assert.match(app, /language-python/);
  assert.match(app, /language-(?:shell|json|html)/);
});

test('状态层固定使用 v2 键并规范化课程范围', () => {
  assert.match(store, /py-course-progress-v2/);
  assert.match(store, /currentDay/);
  assert.match(store, /completed/);
  assert.match(store, /drafts/);
  assert.match(store, /1/);
  assert.match(store, /30/);
  assert.match(store, /localStorage/);
});

test('入口页链接到课程和本地说明', () => {
  assert.match(entry, /basics-course\/index\.html/);
  assert.match(entry, /README\.md/);
});

test('样式包含键盘焦点、桌面侧栏和移动端布局契约', () => {
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /sidebar/);
  assert.match(styles, /@media/);
  assert.match(styles, /code-editor/);
  assert.doesNotMatch(styles, /linear-gradient|radial-gradient/);
});

test('旧课程副本位于 legacy 目录', () => {
  assert.equal(existsSync(resolve(basicsRoot, 'legacy', 'index.html')), true);
});
