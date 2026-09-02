import assert from "node:assert/strict";
import test from "node:test";

import { seedQuestions } from "../src/lib/curriculum";
import { parseQuestionImport } from "../src/lib/importer";

const validQuestion = {
  id: "personal-limite-1",
  courseId: "calculo-1",
  topicId: "limites",
  prerequisiteIds: ["pre-fatoracao"],
  prompt: "Calcule o limite indicado no enunciado.",
  options: [
    { id: "a", text: "0" },
    { id: "b", text: "1" },
    { id: "c", text: "2" },
    { id: "d", text: "Não existe" },
  ],
  correctOptionId: "c",
  explanation: "A simplificação algébrica leva ao valor 2.",
  difficulty: "basico",
  errorType: "Erro de fatoração",
  tags: ["limites"],
};

test("aceita CSV com vírgula e aspas escapadas", () => {
  const csv = [
    "courseId,topicId,prerequisiteIds,prompt,optionA,optionB,optionC,optionD,correctOptionId,explanation,difficulty,errorType,tags",
    'calculo-1,limites,pre-fatoracao,"Calcule o limite, usando fatoração.",0,1,2,3,c,"Fatore ""antes"" de substituir.",basico,Algebra,limites',
  ].join("\n");
  const result = parseQuestionImport(csv);

  assert.deepEqual(result.errors, []);
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].prompt, "Calcule o limite, usando fatoração.");
  assert.equal(result.questions[0].explanation, 'Fatore "antes" de substituir.');
});

test("rejeita tópico de outro curso, pré-requisito desconhecido e alternativa duplicada", () => {
  const invalid = {
    ...validQuestion,
    courseId: "calculo-2",
    prerequisiteIds: ["pre-inexistente"],
    options: [
      { id: "a", text: "0" },
      { id: "a", text: "1" },
      { id: "c", text: "2" },
      { id: "d", text: "3" },
    ],
  };
  const result = parseQuestionImport(JSON.stringify(invalid));

  assert.equal(result.questions.length, 0);
  assert.match(result.errors.join(" "), /não pertence ao curso/);
  assert.match(result.errors.join(" "), /não existe/);
  assert.match(result.errors.join(" "), /duplicado/);
});

test("impede sobrescrever IDs do banco oficial", () => {
  const result = parseQuestionImport(
    JSON.stringify({ ...validQuestion, id: seedQuestions[0].id }),
  );

  assert.equal(result.questions.length, 0);
  assert.match(result.errors.join(" "), /reservado/);
});
