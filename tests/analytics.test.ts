import assert from "node:assert/strict";
import test from "node:test";

import { buildDiagnostics, getTopicMastery } from "../src/lib/analytics";
import { seedQuestions } from "../src/lib/curriculum";
import type { Attempt, Question } from "../src/lib/types";

const limitQuestions = seedQuestions.filter(
  (question) => question.courseId === "calculo-1" && question.topicId === "limites",
);

function attempt(
  question: Question,
  id: string,
  correct: boolean,
  overrides: Partial<Attempt> = {},
): Attempt {
  return {
    id,
    questionId: question.id,
    courseId: question.courseId,
    topicId: question.topicId,
    prerequisiteIds: correct ? [] : ["pre-fatoracao"],
    selectedOptionId: correct ? question.correctOptionId : "incorreta",
    correctOptionId: question.correctOptionId,
    correct,
    timeSpentSeconds: 30,
    difficulty: question.difficulty,
    errorType: correct ? "Acerto" : "Erro de fatoração",
    createdAt: new Date().toISOString(),
    source: "practice",
    ...overrides,
  };
}

test("repetir uma questão não conclui um tópico inteiro", () => {
  const repeated = [0, 1, 2, 3].map((index) =>
    attempt(limitQuestions[0], `repeat-${index}`, true),
  );
  const mastery = getTopicMastery(seedQuestions, repeated, "limites");

  assert.equal(mastery.uniqueCorrect, 1);
  assert.equal(mastery.mastered, false);
});

test("domínio exige cobertura distinta e pelo menos 70% de precisão", () => {
  const required = Math.ceil(limitQuestions.length * 0.5);
  const successful = limitQuestions
    .slice(0, required)
    .map((question, index) => attempt(question, `correct-${index}`, true));
  const mastery = getTopicMastery(seedQuestions, successful, "limites");

  assert.equal(mastery.uniqueCorrect, required);
  assert.equal(mastery.accuracy, 1);
  assert.equal(mastery.mastered, true);
});

test("tentativas expiradas não afetam diagnóstico e o distrator atribui só a base ligada", () => {
  const question = limitQuestions[0];
  const attempts = [
    attempt(question, "expired", false, {
      assessmentStatus: "expired",
      prerequisiteIds: ["pre-produtos-notaveis"],
    }),
    attempt(question, "active", false, {
      prerequisiteIds: ["pre-fatoracao"],
    }),
  ];
  const diagnostics = buildDiagnostics(seedQuestions, attempts);

  assert.equal(diagnostics.totalAttempts, 1);
  assert.equal(
    diagnostics.prerequisiteStats.find((item) => item.prerequisiteId === "pre-fatoracao")?.attempts,
    1,
  );
  assert.equal(
    diagnostics.prerequisiteStats.find((item) => item.prerequisiteId === "pre-produtos-notaveis")?.attempts,
    0,
  );
});
