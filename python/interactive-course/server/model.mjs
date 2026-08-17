export class Catalog {
  constructor(course, lessons) {
    this.course = Object.freeze({ ...course });
    this.lessons = new Map(
      lessons.map((lesson) => [lesson.id, Object.freeze({ ...lesson })]),
    );
  }

  lesson(id) {
    const lesson = this.lessons.get(id);
    if (!lesson) throw new Error('未知课节: ' + id);
    return lesson;
  }

  publicCourse() {
    return {
      ...this.course,
      lessons: [...this.lessons.values()].map(
        ({ hiddenTest, ...lesson }) => lesson,
      ),
    };
  }
}
