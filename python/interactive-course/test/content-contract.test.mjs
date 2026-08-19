import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLessonMetadata } from '../server/content-contract.mjs';

function validLesson() {
  return {
    id: 'python-functions-01',
    track: 'python',
    stage: 'foundation',
    title: '用函数汇总日志',
    module: { id: 'reusable-programs', title: '可复用程序', order: 2 },
    order: 6,
    objectives: ['定义函数', '返回统计结果'],
    prerequisites: ['python-loops-01'],
    activityTypes: ['guided', 'rebuild'],
    sourceRefs: ['python-docs-functions'],
    estimatedMinutes: 75,
    explanation: '使用函数建立清晰的输入和输出边界。',
    exerciseGoal: '实现 summarize(lines)。',
    hints: ['先统计总数', '再统计错误数'],
    concepts: [{
      title: '函数边界',
      explanation: '函数把输入、处理和输出组织在一起。',
      analogy: '类似把前端数据转换封装为纯函数。',
      code: 'def summarize(lines):\n    return {"total": len(lines)}',
    }],
    commonMistakes: [{
      symptom: '函数没有返回值。',
      cause: '只计算了局部变量。',
      fix: '使用 return 返回统计字典。',
    }],
    exercise: {
      goal: '返回 total 和 errors。',
      steps: ['创建统计变量', '遍历并返回结果'],
      acceptance: ['空列表返回两个零', 'ERROR 行计入 errors'],
    },
    recap: ['函数需要明确输入与返回值', '统计函数会进入日志审计器'],
  };
}

test('accepts a complete structured lesson', () => {
  const metadata = validLesson();
  assert.equal(validateLessonMetadata(metadata, metadata.id), metadata);
});

test('rejects incomplete structured lesson fields', () => {
  const invalidCases = [
    {
      field: 'concepts',
      mutate(metadata) {
        delete metadata.concepts;
      },
    },
    {
      field: 'exercise.steps',
      mutate(metadata) {
        metadata.exercise.steps = [];
      },
    },
    {
      field: 'module.order',
      mutate(metadata) {
        metadata.module.order = 0;
      },
    },
    {
      field: 'placeholder',
      mutate(metadata) {
        metadata.explanation = 'TODO: 补充函数边界说明';
      },
    },
  ];

  for (const { field, mutate } of invalidCases) {
    const metadata = validLesson();
    mutate(metadata);
    assert.throws(
      () => validateLessonMetadata(metadata, metadata.id),
      (error) => {
        assert.match(error.message, /python-functions-01/);
        assert.match(error.message, new RegExp(field.replace('.', '\\.'), 'u'));
        return true;
      },
    );
  }
});
