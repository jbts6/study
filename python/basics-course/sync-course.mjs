import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildLessons,
  COURSE_BRANCH,
  COURSE_DAYS,
  COURSE_REPOSITORY,
  selectLessonFile,
} from './course-lessons.mjs';
import { writeGeneratedLessons } from './course-output.mjs';

export {
  buildLessons,
  COURSE_BRANCH,
  COURSE_DAYS,
  COURSE_REPOSITORY,
  selectLessonFile,
  writeGeneratedLessons,
};

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
  if (!isWithin(PYTHON_ROOT, UPSTREAM_PATH)) {
    throw new Error(`upstream path must stay inside python/: ${UPSTREAM_PATH}`);
  }

  mkdirSync(dirname(UPSTREAM_PATH), { recursive: true });
  if (existsSync(UPSTREAM_PATH)) {
    runGit(['-C', UPSTREAM_PATH, 'pull', '--ff-only']);
  } else {
    runGit([
      'clone',
      '--depth',
      '1',
      '--branch',
      COURSE_BRANCH,
      REPOSITORY_URL,
      UPSTREAM_PATH,
    ]);
  }

  return UPSTREAM_PATH;
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
