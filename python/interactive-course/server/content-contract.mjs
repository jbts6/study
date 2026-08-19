const REQUIRED_TEXT = [
  'id',
  'track',
  'stage',
  'title',
  'explanation',
  'exerciseGoal',
];

const REQUIRED_LISTS = [
  'objectives',
  'activityTypes',
  'sourceRefs',
  'hints',
  'concepts',
  'commonMistakes',
  'recap',
];

const PLACEHOLDER_WORDS = [
  'TO' + 'DO',
  'TB' + 'D',
  'FIX' + 'ME',
  '待补充',
  '稍后实现',
];

const PLACEHOLDER_PATTERN = new RegExp(PLACEHOLDER_WORDS.join('|'), 'i');

export function validateLessonMetadata(metadata, expectedId) {
  requireObject(metadata, expectedId, 'lesson');
  if (metadata.id !== expectedId) fail(expectedId, 'id');

  for (const field of REQUIRED_TEXT) {
    requireText(metadata[field], expectedId, field);
  }
  for (const field of REQUIRED_LISTS) {
    requireList(metadata[field], expectedId, field);
  }

  requirePositiveInteger(metadata.order, expectedId, 'order');
  validateModule(metadata.module, expectedId);
  metadata.concepts.forEach((value, index) => {
    validateConcept(value, expectedId, index);
  });
  metadata.commonMistakes.forEach((value, index) => {
    validateMistake(value, expectedId, index);
  });
  validateExercise(metadata.exercise, expectedId);

  if (PLACEHOLDER_PATTERN.test(JSON.stringify(metadata))) {
    fail(expectedId, 'placeholder');
  }

  return metadata;
}

function requireObject(value, lessonId, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(lessonId, field);
  }
}

function requireText(value, lessonId, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(lessonId, field);
  }
}

function requireList(value, lessonId, field) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(lessonId, field);
  }
}

function requirePositiveInteger(value, lessonId, field) {
  if (!Number.isInteger(value) || value <= 0) {
    fail(lessonId, field);
  }
}

function validateModule(module, lessonId) {
  requireObject(module, lessonId, 'module');
  requireText(module.id, lessonId, 'module.id');
  requireText(module.title, lessonId, 'module.title');
  requirePositiveInteger(module.order, lessonId, 'module.order');
}

function validateConcept(concept, lessonId, index) {
  const field = `concepts[${index}]`;
  requireObject(concept, lessonId, field);
  requireText(concept.title, lessonId, `${field}.title`);
  requireText(concept.explanation, lessonId, `${field}.explanation`);
  requireText(concept.analogy, lessonId, `${field}.analogy`);
  requireText(concept.code, lessonId, `${field}.code`);
}

function validateMistake(mistake, lessonId, index) {
  const field = `commonMistakes[${index}]`;
  requireObject(mistake, lessonId, field);
  requireText(mistake.symptom, lessonId, `${field}.symptom`);
  requireText(mistake.cause, lessonId, `${field}.cause`);
  requireText(mistake.fix, lessonId, `${field}.fix`);
}

function validateExercise(exercise, lessonId) {
  requireObject(exercise, lessonId, 'exercise');
  requireText(exercise.goal, lessonId, 'exercise.goal');
  requireList(exercise.steps, lessonId, 'exercise.steps');
  requireList(exercise.acceptance, lessonId, 'exercise.acceptance');
}

function fail(lessonId, field) {
  throw new Error(`课节 ${lessonId} 的 ${field} 无效`);
}
