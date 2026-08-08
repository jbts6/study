import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Catalog } from './model.mjs';

const DEFAULT_CONTENT_ROOT = fileURLToPath(
  new URL('../internal/course/content/', import.meta.url),
);
const REQUIRED_CODE_FILES = Object.freeze({
  exampleCode: 'example.rs',
  starterCode: 'starter.rs',
  hiddenTest: 'hidden_test.rs',
});

export function loadCatalog(contentRoot = DEFAULT_CONTENT_ROOT) {
  const root = resolveContentRoot(contentRoot);
  const course = readJson(join(root, 'course.json'), 'course metadata');
  const lessons = readLessonEntries(root, course.lessons);

  validateCourse(course, lessons, root);
  return new Catalog({
    id: requiredText(course.id, 'course ID'),
    title: requiredText(course.title, 'course title'),
    lessons,
  });
}

function resolveContentRoot(contentRoot) {
  if (contentRoot instanceof URL) {
    return fileURLToPath(contentRoot);
  }
  if (typeof contentRoot !== 'string') {
    throw new TypeError('contentRoot must be a filesystem path or file URL');
  }
  return isAbsolute(contentRoot)
    ? contentRoot
    : resolve(fileURLToPath(new URL('.', import.meta.url)), contentRoot);
}

function readJson(filePath, label) {
  let source;
  try {
    source = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read ${label}: ${error.message}`, { cause: error });
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Unable to parse ${label}: ${error.message}`, { cause: error });
  }
}

function readLessonEntries(root, metadata) {
  if (!Array.isArray(metadata) || metadata.length === 0) {
    throw new Error('course lessons must be a non-empty array');
  }

  const seen = new Set();
  return metadata.map((entry) => {
    const descriptor = typeof entry === 'string' ? { id: entry } : entry;
    if (!descriptor || typeof descriptor !== 'object') {
      throw new Error('each course lesson must be an object or lesson ID');
    }

    const id = requiredText(descriptor.id, 'lesson ID');
    if (seen.has(id)) {
      throw new Error(`duplicate lesson ID ${JSON.stringify(id)}`);
    }
    seen.add(id);

    const lessonRoot = lessonDirectory(root, id, descriptor);
    const lessonMetadataPath = join(lessonRoot, 'lesson.json');
    const lessonMetadata = existsSync(lessonMetadataPath)
      ? readJson(lessonMetadataPath, `lesson ${JSON.stringify(id)} metadata`)
      : {};
    const lesson = { ...descriptor, ...lessonMetadata, id };

    for (const [field, filename] of Object.entries(REQUIRED_CODE_FILES)) {
      lesson[field] = readRequiredText(lessonRoot, id, filename);
    }
    validateLesson(lesson);
    return lesson;
  });
}

function lessonDirectory(root, id, descriptor) {
  const relativePath = descriptor.path ?? descriptor.directory ?? join('lessons', id);
  const lessonRoot = resolve(root, relativePath);
  const outsideRoot = relative(root, lessonRoot).startsWith('..');
  if (outsideRoot) {
    throw new Error(`lesson ${JSON.stringify(id)} path escapes content root`);
  }
  return lessonRoot;
}

function readRequiredText(lessonRoot, id, filename) {
  const filePath = join(lessonRoot, filename);
  let value;
  try {
    value = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(
      `lesson ${JSON.stringify(id)} missing ${filename}: ${error.message}`,
      { cause: error },
    );
  }
  if (value.trim() === '') {
    throw new Error(`lesson ${JSON.stringify(id)} has empty ${filename}`);
  }
  return value;
}

function validateCourse(course, lessons, root) {
  requiredText(course?.id, 'course ID');
  requiredText(course?.title, 'course title');
  if (!Array.isArray(course.lessons) || course.lessons.length !== lessons.length) {
    throw new Error('course lesson metadata is inconsistent');
  }

  const lessonDirectories = join(root, 'lessons');
  if (existsSync(lessonDirectories)) {
    const declared = new Set(lessons.map((lesson) => lesson.id));
    const actual = readdirSync(lessonDirectories, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const unexpected = actual.filter((id) => !declared.has(id));
    if (unexpected.length > 0) {
      throw new Error(`unexpected lesson directories: ${unexpected.join(', ')}`);
    }
  }
}

function validateLesson(lesson) {
  if (lesson.id !== requiredText(lesson.id, 'lesson ID')) {
    throw new Error('lesson ID is inconsistent');
  }
  for (const field of ['title', 'goal', 'explanation', 'exerciseGoal']) {
    requiredText(lesson[field], `lesson ${JSON.stringify(lesson.id)} ${field}`);
  }
  if (!Array.isArray(lesson.hints) || lesson.hints.length === 0) {
    throw new Error(`lesson ${JSON.stringify(lesson.id)} must have hints`);
  }
  lesson.hints.forEach((hint) => requiredText(hint, `lesson ${JSON.stringify(lesson.id)} hint`));

  if (!Array.isArray(lesson.tests) || lesson.tests.length === 0) {
    throw new Error(`lesson ${JSON.stringify(lesson.id)} must have public tests`);
  }
  const testIds = new Set();
  lesson.tests.forEach((test) => {
    const testId = requiredText(test?.id, `lesson ${JSON.stringify(lesson.id)} test ID`);
    requiredText(test?.label, `lesson ${JSON.stringify(lesson.id)} test label`);
    if (testIds.has(testId)) {
      throw new Error(`lesson ${JSON.stringify(lesson.id)} has duplicate test ID ${JSON.stringify(testId)}`);
    }
    testIds.add(testId);
  });
}

function requiredText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}
