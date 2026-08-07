import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

import {
  buildLessons,
  selectLessonFile,
  writeGeneratedLessons,
} from './sync-course.mjs';
import { replaceFileWithRollback } from './course-output.mjs';

function createFixture() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'python-course-'));

  const writeFixture = (relativePath, content) => {
    const filePath = join(fixtureRoot, relativePath);
    mkdirSync(join(filePath, '..'), { recursive: true });
    writeFileSync(filePath, content, 'utf8');
  };

  writeFixture(
    '01_Day_Introduction/helloworld.py',
    'print("Hello, Python!")\n',
  );
  writeFixture(
    'Chinese/02_variables.md',
    '# 第二天：变量\n\n普通中文课程。\n',
  );
  writeFixture(
    'Chinese/02_variables_cn.md',
    '# 第二天：变量（中文）\n\n优先中文课程。\n',
  );
  writeFixture(
    'Chinese/03_operators.md',
    '# 第三天：运算符\n\n普通中文课程。\n',
  );
  writeFixture(
    '03_Day_Operators/03_operators.md',
    '# Day 3: Operators\n\nEnglish course.\n',
  );

  for (let day = 4; day <= 30; day += 1) {
    const dayDirectory = `${String(day).padStart(2, '0')}_Day_Lesson`;
    writeFixture(
      `${dayDirectory}/${String(day).padStart(2, '0')}_lesson.md`,
      day === 4
        ? '导言\n## 第四天：首个标题\n# 后续标题\n'
        : day === 5
          ? '这一天没有 Markdown 标题。\n'
          : `# Day ${day}: Lesson\n\nLesson ${day}.\n`,
    );
  }

  return fixtureRoot;
}

test('中文 _cn 文件优先于普通中文文件', (t) => {
  const fixtureRoot = createFixture();
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));

  const lesson = selectLessonFile(fixtureRoot, 2);

  assert.equal(lesson.sourcePath, 'Chinese/02_variables_cn.md');
  assert.equal(lesson.language, 'zh-CN');
});

test('中文缺失时回退到英文日课', (t) => {
  const fixtureRoot = createFixture();
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
  rmSync(join(fixtureRoot, 'Chinese/03_operators.md'));

  const lesson = selectLessonFile(fixtureRoot, 3);

  assert.equal(lesson.sourcePath, '03_Day_Operators/03_operators.md');
  assert.equal(lesson.language, 'en');
});

test('课程生成严格包含 30 天且按 day 排序', (t) => {
  const fixtureRoot = createFixture();
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));

  const lessons = buildLessons(fixtureRoot);

  assert.equal(lessons.length, 30);
  assert.deepEqual(
    lessons.map((item) => item.day),
    Array.from({ length: 30 }, (_, index) => index + 1),
  );
  assert.match(lessons[0].content, /Hello,? Python|Python/);
  assert.match(lessons[1].sourceUrl, /Asabeneh\/30-Days-Of-Python/);
});

test('课程标题取首个一级或二级标题', (t) => {
  const fixtureRoot = createFixture();
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));

  const lessons = buildLessons(fixtureRoot);

  assert.equal(lessons[3].title, '第四天：首个标题');
});

test('课程没有标题时回退为带两位数的日期标题', (t) => {
  const fixtureRoot = createFixture();
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));

  const lessons = buildLessons(fixtureRoot);

  assert.equal(lessons[4].title, '第 05 天');
});

test('生成文件使用可执行的 window 数据结构', (t) => {
  const fixtureRoot = createFixture();
  const pythonRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const outputRoot = mkdtempSync(join(pythonRoot, '.python-course-generated-'));
  t.after(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
    rmSync(outputRoot, { recursive: true, force: true });
  });
  const outputPath = join(outputRoot, 'lessons.js');
  const lessons = buildLessons(fixtureRoot);

  writeGeneratedLessons(outputPath, lessons);

  const context = { window: {} };
  runInNewContext(readFileSync(outputPath, 'utf8'), context);
  assert.equal(context.window.PYTHON_COURSE.lessons.length, 30);
  assert.equal(context.window.PYTHON_COURSE.source, 'Asabeneh/30-Days-Of-Python');
});

test('临时文件写入失败时保留已有生成文件并清理临时文件', (t) => {
  const fixtureRoot = createFixture();
  const pythonRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const outputRoot = mkdtempSync(join(pythonRoot, '.python-course-generated-'));
  t.after(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
    rmSync(outputRoot, { recursive: true, force: true });
  });

  const outputPath = join(outputRoot, 'lessons.js');
  const oldContent = '旧生成文件';
  writeFileSync(outputPath, oldContent, 'utf8');
  const fileSystem = {
    existsSync,
    mkdirSync,
    renameSync,
    rmSync,
    writeFileSync(filePath, ...args) {
      if (filePath.endsWith('.tmp')) {
        throw new Error('模拟临时文件写入失败');
      }
      return writeFileSync(filePath, ...args);
    },
  };

  assert.throws(
    () => writeGeneratedLessons(outputPath, buildLessons(fixtureRoot), fileSystem),
    /模拟临时文件写入失败/,
  );
  assert.equal(readFileSync(outputPath, 'utf8'), oldContent);
  assert.deepEqual(readdirSync(outputRoot), ['lessons.js']);
});

test('生成文件临时文件必须与输出文件位于同一目录', (t) => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'python-course-output-'));
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'python-course-temp-'));
  t.after(() => {
    rmSync(outputRoot, { recursive: true, force: true });
    rmSync(temporaryRoot, { recursive: true, force: true });
  });
  const outputPath = join(outputRoot, 'lessons.js');
  const temporaryPath = join(temporaryRoot, 'lessons.js.tmp');
  writeFileSync(temporaryPath, '新生成文件', 'utf8');

  assert.throws(
    () => replaceFileWithRollback(temporaryPath, outputPath),
    /same directory/,
  );
  assert.equal(existsSync(outputPath), false);
  assert.equal(existsSync(temporaryPath), true);
});

test('生成文件替换失败时保留旧文件并清理临时文件', (t) => {
  const fixtureRoot = createFixture();
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
  const outputPath = join(fixtureRoot, 'lessons.js');
  const temporaryPath = join(fixtureRoot, 'lessons.js.tmp');
  writeFileSync(outputPath, '旧生成文件', 'utf8');
  writeFileSync(temporaryPath, '新生成文件', 'utf8');

  let renameCount = 0;
  const fileSystem = {
    existsSync,
    renameSync(source, destination) {
      renameCount += 1;
      if (renameCount === 2) {
        throw new Error('模拟替换失败');
      }
      renameSync(source, destination);
    },
    rmSync,
  };

  assert.throws(
    () => replaceFileWithRollback(temporaryPath, outputPath, fileSystem),
    /模拟替换失败/,
  );
  assert.equal(readFileSync(outputPath, 'utf8'), '旧生成文件');
  assert.equal(existsSync(temporaryPath), false);
  assert.equal(
    readdirSync(fixtureRoot).some((name) => name.includes('.backup-')),
    false,
  );
});
