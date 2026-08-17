import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Catalog } from './model.mjs';

const DEFAULT_ROOT = fileURLToPath(
  new URL('../internal/course/content/', import.meta.url),
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

export function loadCourse(contentRoot = DEFAULT_ROOT) {
  const root = path.resolve(contentRoot);
  const course = readJson(path.join(root, 'course.json'));
  const seen = new Set();

  const lessons = course.lessons.map((entry) => {
    if (seen.has(entry.id)) throw new Error('课节 id 重复: ' + entry.id);
    seen.add(entry.id);

    const lessonRoot = path.join(root, entry.directory);
    const metadata = readJson(path.join(lessonRoot, 'lesson.json'));
    if (metadata.id !== entry.id) {
      throw new Error('课节 id 与目录声明不一致: ' + entry.id);
    }

    return {
      ...metadata,
      starterCode: readText(path.join(lessonRoot, 'starter.py')),
      exampleCode: readText(path.join(lessonRoot, 'example.py')),
      hiddenTest: readText(path.join(lessonRoot, 'hidden_test.py')),
    };
  });

  return new Catalog(
    {
      id: course.id,
      title: course.title,
      track: course.track,
      stage: course.stage,
    },
    lessons,
  );
}
