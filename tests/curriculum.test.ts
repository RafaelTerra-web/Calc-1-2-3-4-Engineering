import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultAssessments,
  selectAssessmentQuestions,
  validateAssessmentQuestionPool,
} from "../src/lib/assessments";
import { prerequisites, seedQuestions, topics } from "../src/lib/curriculum";

test("o banco autoral cobre todos os tópicos com IDs e alternativas válidos", () => {
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const prerequisiteIds = new Set(prerequisites.map((item) => item.id));
  const questionIds = new Set<string>();

  for (const topic of topics) {
    assert.ok(
      seedQuestions.some((question) => question.topicId === topic.id),
      `tópico sem questão: ${topic.id}`,
    );
  }

  for (const question of seedQuestions) {
    assert.ok(!questionIds.has(question.id), `ID duplicado: ${question.id}`);
    questionIds.add(question.id);
    assert.equal(topicById.get(question.topicId)?.courseId, question.courseId);
    assert.equal(new Set(question.options.map((option) => option.id)).size, question.options.length);
    assert.equal(
      question.options.filter((option) => option.id === question.correctOptionId).length,
      1,
    );
    for (const prerequisiteId of question.prerequisiteIds) {
      assert.ok(prerequisiteIds.has(prerequisiteId));
    }
  }
});

test("cada prova pode ser montada exatamente no tópico e no mix solicitado", () => {
  const assessments = createDefaultAssessments(new Date("2030-03-10T12:00:00-03:00"));

  for (const assessment of assessments) {
    const validation = validateAssessmentQuestionPool(assessment, seedQuestions);
    assert.deepEqual(validation.errors, [], `${assessment.id}: ${validation.errors.join("; ")}`);

    const selected = selectAssessmentQuestions(assessment, seedQuestions, new Set(), () => 0.25);
    assert.equal(selected.length, assessment.questionCount);
    assert.ok(selected.every((question) => question.courseId === assessment.courseId));
    assert.ok(selected.every((question) => question.topicId === assessment.topicId));

    for (const difficulty of ["basico", "medio", "avancado"] as const) {
      assert.equal(
        selected.filter((question) => question.difficulty === difficulty).length,
        assessment.difficultyMix[difficulty] ?? 0,
      );
    }
  }
});

test("o calendário padrão é relativo à data de referência", () => {
  const [first, , third] = createDefaultAssessments(
    new Date("2030-03-10T12:00:00-03:00"),
  );

  assert.equal(new Date(first.availableAt).getFullYear(), 2030);
  assert.equal(new Date(first.dueAt).getDate(), 18);
  assert.equal(new Date(third.availableAt).getDate(), 14);
});
