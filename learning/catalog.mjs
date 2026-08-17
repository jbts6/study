import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PATH = fileURLToPath(
  new URL('./catalog.json', import.meta.url),
);
const TRACK_IDS = ['python', 'go', 'rust'];

export function loadLearningCatalog(filePath = DEFAULT_PATH) {
  const value = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  if (value.version !== 1 || !Array.isArray(value.tracks)) {
    throw new Error('学习目录格式无效');
  }

  const ids = value.tracks.map((track) => track.id);
  if (ids.join(',') !== TRACK_IDS.join(',')) {
    throw new Error('学习顺序必须是 python、go、rust');
  }

  for (const track of value.tracks) {
    for (const field of [
      'id',
      'stage',
      'title',
      'entryCommand',
      'representativeUnit',
    ]) {
      if (typeof track[field] !== 'string' || !track[field].trim()) {
        throw new Error('学习目录缺少字段: ' + field);
      }
    }
  }

  return Object.freeze({
    version: value.version,
    currentTrack: value.currentTrack,
    tracks: value.tracks.map((track) => Object.freeze({ ...track })),
  });
}
