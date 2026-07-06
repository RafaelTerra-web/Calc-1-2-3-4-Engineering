import { z } from "zod";
import { courses, topics } from "@/lib/curriculum";
import type { CourseId, Difficulty, Question } from "@/lib/types";

const courseIds = courses.map((course) => course.id) as [CourseId, ...CourseId[]];
const topicIds = topics.map((topic) => topic.id);

const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

const questionSchema = z.object({
  id: z.string().optional(),
  courseId: z.enum(courseIds),
  topicId: z.string().refine((value) => topicIds.includes(value), {
    message: "Topic does not exist in the curriculum.",
  }),
  prerequisiteIds: z.array(z.string()).default([]),
  prompt: z.string().min(8),
  options: z.array(optionSchema).min(4).max(5),
  correctOptionId: z.string().min(1),
  explanation: z.string().min(8),
  difficulty: z.enum(["basico", "medio", "avancado"]),
  errorType: z.string().min(3),
  tags: z.array(z.string()).default([]),
});

export type ImportResult = {
  questions: Question[];
  errors: string[];
};

export function parseQuestionImport(rawInput: string): ImportResult {
  const input = rawInput.trim();

  if (!input) {
    return { questions: [], errors: ["Cole um JSON ou CSV antes de importar."] };
  }

  if (input.startsWith("[") || input.startsWith("{")) {
    return parseJsonQuestions(input);
  }

  return parseCsvQuestions(input);
}

function parseJsonQuestions(input: string): ImportResult {
  try {
    const parsed = JSON.parse(input);
    const rows = Array.isArray(parsed) ? parsed : [parsed];

    return normalizeRows(rows);
  } catch {
    return { questions: [], errors: ["JSON invalido. Verifique aspas, virgulas e colchetes."] };
  }
}

function parseCsvQuestions(input: string): ImportResult {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      questions: [],
      errors: ["CSV precisa ter cabecalho e pelo menos uma linha de questao."],
    };
  }

  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const record = Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""]),
    );

    return {
      id: record.id || undefined,
      courseId: record.courseId,
      topicId: record.topicId,
      prerequisiteIds: splitList(record.prerequisiteIds),
      prompt: record.prompt,
      options: [
        { id: "a", text: record.optionA },
        { id: "b", text: record.optionB },
        { id: "c", text: record.optionC },
        { id: "d", text: record.optionD },
        record.optionE ? { id: "e", text: record.optionE } : undefined,
      ].filter(Boolean),
      correctOptionId: record.correctOptionId,
      explanation: record.explanation,
      difficulty: record.difficulty as Difficulty,
      errorType: record.errorType,
      tags: splitList(record.tags),
    };
  });

  return normalizeRows(rows);
}

function normalizeRows(rows: unknown[]): ImportResult {
  const questions: Question[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const result = questionSchema.safeParse(row);

    if (!result.success) {
      errors.push(
        `Linha ${index + 1}: ${result.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      );
      return;
    }

    if (
      !result.data.options.some(
        (option) => option.id === result.data.correctOptionId,
      )
    ) {
      errors.push(`Linha ${index + 1}: alternativa correta nao existe.`);
      return;
    }

    questions.push({
      ...result.data,
      id:
        result.data.id ??
        `imported-${Date.now()}-${index}-${result.data.topicId}`,
    });
  });

  return { questions, errors };
}

function splitList(value: string | undefined) {
  return (value ?? "")
    .split(/[|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}
