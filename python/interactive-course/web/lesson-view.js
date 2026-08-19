export function groupLessons(lessons = []) {
  const groups = [];
  for (const lesson of lessons) {
    const last = groups.at(-1);
    if (!last || last.module.id !== lesson.module.id) {
      groups.push({ module: lesson.module, lessons: [lesson] });
    } else {
      last.lessons.push(lesson);
    }
  }
  return groups;
}

export function isLessonUnlocked(lessons, lessonId, practiced = []) {
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  return index === 0 || (index > 0 && practiced.includes(lessons[index - 1].id));
}

export function renderLessonContent(lesson) {
  return [
    renderHeading(lesson),
    renderObjectives(lesson.objectives),
    renderConcepts(lesson.concepts),
    renderMistakes(lesson.commonMistakes),
    renderExercise(lesson.exercise),
    renderHints(lesson.hints),
    renderReference(lesson.exampleCode),
    renderRecap(lesson.recap),
  ].join('');
}

function renderHeading(lesson) {
  const moduleTitle = lesson.module?.title || 'Python 课程';
  const minutes = lesson.estimatedMinutes
    ? ` · ${escapeHtml(lesson.estimatedMinutes)} 分钟`
    : '';
  return `
    <header class="lesson-heading">
      <p class="eyebrow">${escapeHtml(moduleTitle)} · 第 ${escapeHtml(lesson.order)} 课${minutes}</p>
      <h2>${escapeHtml(lesson.title)}</h2>
      <p class="lesson-goal">${escapeHtml(lesson.exercise?.goal || lesson.exerciseGoal || '')}</p>
    </header>`;
}

function renderObjectives(objectives = []) {
  return renderSection('本节目标', `<ul>${renderList(objectives)}</ul>`, 'lesson-objectives');
}

function renderConcepts(concepts = []) {
  const items = concepts.map((concept) => `
    <article class="lesson-concept">
      <h3>${escapeHtml(concept.title)}</h3>
      <p>${escapeHtml(concept.explanation)}</p>
      <p class="concept-analogy"><strong>前端类比：</strong>${escapeHtml(concept.analogy)}</p>
      <pre class="example-code"><code>${escapeHtml(concept.code)}</code></pre>
    </article>`).join('');
  return renderSection('概念讲解', items, 'lesson-concepts');
}

function renderMistakes(mistakes = []) {
  const items = mistakes.map((mistake) => `
    <article class="lesson-mistake">
      <h3>${escapeHtml(mistake.symptom)}</h3>
      <dl>
        <div><dt>原因</dt><dd>${escapeHtml(mistake.cause)}</dd></div>
        <div><dt>修正</dt><dd>${escapeHtml(mistake.fix)}</dd></div>
      </dl>
    </article>`).join('');
  return renderSection('常见错误', items, 'lesson-mistakes');
}

function renderExercise(exercise = {}) {
  return `
    <section class="lesson-section lesson-exercise" aria-labelledby="exercise-title">
      <h2 id="exercise-title">引导练习</h2>
      <p>${escapeHtml(exercise.goal)}</p>
      <div class="exercise-columns">
        <section><h3>实施步骤</h3><ol>${renderList(exercise.steps)}</ol></section>
        <section><h3>验收条件</h3><ul>${renderList(exercise.acceptance)}</ul></section>
      </div>
    </section>`;
}

function renderHints(hints = []) {
  return `
    <section class="lesson-section lesson-hints">
      <details>
        <summary>分级提示</summary>
        <ol>${renderList(hints)}</ol>
      </details>
    </section>`;
}

function renderReference(exampleCode) {
  return `
    <section class="lesson-section lesson-reference">
      <details>
        <summary>参考实现</summary>
        <pre class="example-code"><code>${escapeHtml(exampleCode || '暂无参考实现')}</code></pre>
      </details>
    </section>`;
}

function renderRecap(recap = []) {
  return renderSection('本节总结', `<ul>${renderList(recap)}</ul>`, 'lesson-recap');
}

function renderSection(title, content, className) {
  return `
    <section class="lesson-section ${className}">
      <h2>${escapeHtml(title)}</h2>
      ${content}
    </section>`;
}

function renderList(values = []) {
  return values.map((value) => `<li>${escapeHtml(value)}</li>`).join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
