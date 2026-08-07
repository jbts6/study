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
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
};

export function replaceFileWithRollback(
  temporaryPath,
  outputPath,
  fileSystem = defaultFileSystem,
) {
  const resolvedTemporaryPath = resolve(temporaryPath);
  const resolvedOutputPath = resolve(outputPath);
  if (dirname(resolvedTemporaryPath) !== dirname(resolvedOutputPath)) {
    throw new Error('temporary and output files must be in the same directory');
  }

  const backupPath = `${resolvedOutputPath}.backup-${randomUUID()}`;
  let backupCreated = false;

  try {
    if (fileSystem.existsSync(resolvedOutputPath)) {
      fileSystem.renameSync(resolvedOutputPath, backupPath);
      backupCreated = true;
    }

    fileSystem.renameSync(resolvedTemporaryPath, resolvedOutputPath);
    if (backupCreated) {
      fileSystem.rmSync(backupPath, { force: true });
    }
  } catch (error) {
    if (backupCreated) {
      try {
        if (fileSystem.existsSync(resolvedOutputPath)) {
          fileSystem.rmSync(resolvedOutputPath, { force: true });
        }
        if (fileSystem.existsSync(backupPath)) {
          fileSystem.renameSync(backupPath, resolvedOutputPath);
        }
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
    }
    throw error;
  } finally {
    fileSystem.rmSync(resolvedTemporaryPath, { force: true });
  }
}

export function writeGeneratedLessons(
  outputPath,
  lessons,
  fileSystem = defaultFileSystem,
) {
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

  fileSystem.mkdirSync(dirname(resolvedOutputPath), { recursive: true });
  try {
    fileSystem.writeFileSync(temporaryPath, generated, 'utf8');
    replaceFileWithRollback(temporaryPath, resolvedOutputPath, fileSystem);
  } catch (error) {
    fileSystem.rmSync(temporaryPath, { force: true });
    throw error;
  }
}
