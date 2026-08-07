import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

import { COURSE_DAYS, COURSE_REPOSITORY } from './course-lessons.mjs';

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const PYTHON_ROOT = resolve(MODULE_DIRECTORY, '..');

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

const defaultFileSystem = {
  existsSync,
  renameSync,
  rmSync,
};

export function replaceFileWithRollback(
  temporaryPath,
  outputPath,
  fileSystem = defaultFileSystem,
) {
  const backupPath = `${outputPath}.backup-${randomUUID()}`;
  let backupCreated = false;

  try {
    if (fileSystem.existsSync(outputPath)) {
      fileSystem.renameSync(outputPath, backupPath);
      backupCreated = true;
    }

    fileSystem.renameSync(temporaryPath, outputPath);
    if (backupCreated) {
      fileSystem.rmSync(backupPath, { force: true });
    }
  } catch (error) {
    if (backupCreated) {
      try {
        if (fileSystem.existsSync(outputPath)) {
          fileSystem.rmSync(outputPath, { force: true });
        }
        if (fileSystem.existsSync(backupPath)) {
          fileSystem.renameSync(backupPath, outputPath);
        }
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
    }
    throw error;
  } finally {
    fileSystem.rmSync(temporaryPath, { force: true });
  }
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
  const temporaryPath = `${resolvedOutputPath}.${process.pid}.${randomUUID()}.tmp`;

  mkdirSync(dirname(resolvedOutputPath), { recursive: true });
  try {
    writeFileSync(temporaryPath, generated, 'utf8');
    replaceFileWithRollback(temporaryPath, resolvedOutputPath);
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    throw error;
  }
}
