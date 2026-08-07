import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { relative, resolve, sep } from 'node:path';

export const COURSE_REPOSITORY = 'Asabeneh/30-Days-Of-Python';
export const COURSE_BRANCH = 'master';
export const COURSE_DAYS = 30;

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
