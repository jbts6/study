import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COURSE_REPOSITORY = 'Asabeneh/30-Days-Of-Python';
export const COURSE_BRANCH = 'master';
export const COURSE_DAYS = 30;

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const PYTHON_ROOT = resolve(MODULE_DIRECTORY, '..');
const UPSTREAM_PATH = resolve(
  PYTHON_ROOT,
  'upstream',
  '30-Days-Of-Python',
);
const GENERATED_PATH = resolve(
  PYTHON_ROOT,
  'basics-course',
  'generated',
  'lessons.js',
);
const REPOSITORY_URL = `https://github.com/${COURSE_REPOSITORY}.git`;
const RAW_BASE_URL = `https://raw.githubusercontent.com/${COURSE_REPOSITORY}/${COURSE_BRANCH}`;

function dayToken(day) {
  return String(day).padStart(2, '0');
}

function assertDay(day) {
  if (!Number.isInteger(day) || day < 1 || day > COURSE_DAYS) {
    throw new RangeError(`day must be an integer from 1 to ${COURSE_DAYS}`);
  }
}

function assertDirectory(directoryPath, label) {
  const resolvedPath = resolve(directoryPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`${label} does not exist: ${resolvedPath}`);
  }
  return resolvedPath;
}

function isWithin(rootPath, targetPath) {
  const root = resolve(rootPath);
  const target = resolve(targetPath);
  const targetRelative = relative(root, target);
  return (
    targetRelative !== '' &&
    !targetRelative.startsWith(`..${sep}`) &&
    targetRelative !== '..' &&
    !isAbsolute(targetRelative)
  );
}

function assertPythonOutputPath(outputPath) {
  const resolvedPath = resolve(outputPath);
  if (!isWithin(PYTHON_ROOT, dirname(resolvedPath))) {
    throw new Error(
      `output path must stay inside python/: ${resolvedPath}`,
    );
  }
  return resolvedPath;
}

function sourcePath(repoRoot, absolutePath) {
  return relative(repoRoot, absolutePath).split(sep).join('/');
}

function markdownFiles(directoryPath) {
  const files = [];
  const entries = readdirSync(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = resolve(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...markdownFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(entryPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function hasDayPrefix(filePath, day) {
  const prefix = `${dayToken(day)}_`;
  return filePath
    .split(sep)
    .at(-1)
    .toLowerCase()
    .startsWith(prefix.toLowerCase());
}

function selectChineseFile(repoRoot, day) {
  const chinesePath = resolve(repoRoot, 'Chinese');
  if (!existsSync(chinesePath)) {
    return undefined;
  }

  const files = markdownFiles(chinesePath).filter((filePath) =>
    hasDayPrefix(filePath, day),
  );
  const chineseFile = files.find((filePath) =>
    filePath.toLowerCase().endsWith('_cn.md'),
  );
  const ordinaryFile = files.find(
    (filePath) => !filePath.toLowerCase().endsWith('_cn.md'),
  );

  return chineseFile ?? ordinaryFile;
}

function selectEnglishFile(repoRoot, day) {
  const prefix = `${dayToken(day)}_day`;
  const dayDirectories = readdirSync(repoRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.toLowerCase().startsWith(prefix.toLowerCase()),
    )
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const directory of dayDirectories) {
    const files = markdownFiles(resolve(repoRoot, directory.name));
    if (files.length > 0) {
      return files[0];
    }
  }

  return undefined;
}

function dayOneLesson(repoRoot) {
  const sourcePathValue = '01_Day_Introduction/helloworld.py';
  const helloWorldPath = resolve(repoRoot, sourcePathValue);
  if (!existsSync(helloWorldPath)) {
    throw new Error(`missing day 1 source: ${sourcePathValue}`);
  }

  const source = readFileSync(helloWorldPath, 'utf8').trimEnd();
  const content = [
    '# 第 01 天：Python 入门',
    '',
    '课程入口：先运行下面的 Python 程序，确认解释器已经可以工作。',
    '本课也会介绍 `print`，它可以把文本输出到终端。',
    '',
    `源码文件：${sourcePathValue}`,
    '',
    '```python',
    source,
    '```',
    '',
    `执行方式：\`python ${sourcePathValue}\``,
    '',
  ].join('\n');

  return {
    sourcePath: sourcePathValue,
    language: 'en',
    content,
  };
}

export function selectLessonFile(repoRoot, day) {
  assertDay(day);
  const resolvedRoot = assertDirectory(repoRoot, 'upstream directory');

  if (day === 1) {
    return dayOneLesson(resolvedRoot);
  }

  const selectedPath =
    selectChineseFile(resolvedRoot, day) ?? selectEnglishFile(resolvedRoot, day);
  if (!selectedPath) {
    throw new Error(`missing lesson source for day ${dayToken(day)}`);
  }

  return {
    sourcePath: sourcePath(resolvedRoot, selectedPath),
    language: selectedPath
      .toLowerCase()
      .split(sep)
      .includes('chinese')
      ? 'zh-CN'
      : 'en',
    content: readFileSync(selectedPath, 'utf8'),
  };
}

function extractTitle(content, day) {
  const heading = content.match(/^[ \t]{0,3}#{1,2}[ \t]+(.+?)[ \t]*$/m);
  if (!heading) {
    return `第 ${dayToken(day)} 天`;
  }

  return heading[1].replace(/[ \t]+#+[ \t]*$/, '').trim();
}

function rawSourceUrl(relativeSourcePath) {
  const encodedPath = relativeSourcePath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `${RAW_BASE_URL}/${encodedPath}`;
}

export function buildLessons(repoRoot) {
  const resolvedRoot = assertDirectory(repoRoot, 'upstream directory');
  return Array.from({ length: COURSE_DAYS }, (_, index) => {
    const day = index + 1;
    const selected = selectLessonFile(resolvedRoot, day);

    return {
      id: `day-${dayToken(day)}`,
      day,
      title: extractTitle(selected.content, day),
      content: selected.content,
      sourcePath: selected.sourcePath,
      sourceUrl: rawSourceUrl(selected.sourcePath),
    };
  });
}

export function writeGeneratedLessons(outputPath, lessons) {
  if (!Array.isArray(lessons) || lessons.length !== COURSE_DAYS) {
    throw new Error(`expected exactly ${COURSE_DAYS} lessons`);
  }

  const resolvedOutputPath = assertPythonOutputPath(outputPath);
  const payload = {
    source: COURSE_REPOSITORY,
    lessons,
  };
  const generated = `window.PYTHON_COURSE = ${JSON.stringify(payload, null, 2)};\n`;
  const temporaryPath = `${resolvedOutputPath}.${process.pid}.tmp`;

  mkdirSync(dirname(resolvedOutputPath), { recursive: true });
  try {
    writeFileSync(temporaryPath, generated, 'utf8');
    if (existsSync(resolvedOutputPath) && process.platform === 'win32') {
      writeFileSync(resolvedOutputPath, generated, 'utf8');
      rmSync(temporaryPath, { force: true });
    } else {
      renameSync(temporaryPath, resolvedOutputPath);
    }
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    throw error;
  }
}

function runGit(args) {
  const result = spawnSync('git', args, { stdio: 'inherit' });
  if (result.error) {
    throw new Error(`git ${args.join(' ')} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} exited with ${result.status}`);
  }
}

export function syncUpstream() {
  const resolvedUpstreamPath = resolve(
    PYTHON_ROOT,
    'upstream',
    '30-Days-Of-Python',
  );
  if (!isWithin(PYTHON_ROOT, resolvedUpstreamPath)) {
    throw new Error(`upstream path must stay inside python/: ${resolvedUpstreamPath}`);
  }

  mkdirSync(dirname(resolvedUpstreamPath), { recursive: true });
  if (existsSync(resolvedUpstreamPath)) {
    runGit(['-C', resolvedUpstreamPath, 'pull', '--ff-only']);
  } else {
    runGit([
      'clone',
      '--depth',
      '1',
      '--branch',
      COURSE_BRANCH,
      REPOSITORY_URL,
      resolvedUpstreamPath,
    ]);
  }

  return resolvedUpstreamPath;
}

export function main() {
  const upstreamPath = syncUpstream();
  const lessons = buildLessons(upstreamPath);
  writeGeneratedLessons(GENERATED_PATH, lessons);

  const chineseCount = lessons.filter((lesson) =>
    lesson.sourcePath.split('/')[0].toLowerCase() === 'chinese',
  ).length;
  const englishCount = lessons.length - chineseCount;
  console.log(`upstream directory: ${upstreamPath}`);
  console.log(`language coverage: zh-CN ${chineseCount}, en ${englishCount}`);
  console.log(`${lessons.length} lessons`);
  console.log(`output file: ${GENERATED_PATH}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (error) {
    console.error(`course sync failed: ${error.message}`);
    process.exitCode = 1;
  }
}
