export const PUBLIC_LESSON_FIELDS = Object.freeze([
  'id',
  'title',
  'goal',
  'explanation',
  'exampleCode',
  'starterCode',
  'exerciseGoal',
  'hints',
  'tests',
]);

export class Catalog {
  #course;
  #lessons;

  constructor({ id, title, lessons }) {
    this.#course = { id, title };
    this.#lessons = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  }

  publicCourse() {
    return {
      ...this.#course,
      lessons: [...this.#lessons.values()].map(toPublicLesson),
    };
  }

  lesson(id) {
    return this.#lessons.get(id) ?? null;
  }
}

export function toPublicLesson(lesson) {
  return {
    id: lesson.id,
    title: lesson.title,
    goal: lesson.goal,
    explanation: lesson.explanation,
    exampleCode: lesson.exampleCode,
    starterCode: lesson.starterCode,
    exerciseGoal: lesson.exerciseGoal,
    hints: lesson.hints.map((hint) => hint),
    tests: lesson.tests.map((test) => ({ id: test.id, label: test.label })),
  };
}
