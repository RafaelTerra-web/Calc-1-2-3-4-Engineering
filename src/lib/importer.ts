import { z } from "zod";
import { courses, prerequisites, seedQuestions, topics } from "@/lib/curriculum";
import type { CourseId, Difficulty, Question } from "@/lib/types";

const courseIds = courses.map((course) => course.id) as [CourseId, ...CourseId[]];
const topicById = new Map(topics.map((topic) => [topic.id, topic]));
const prerequisiteIds = new Set(prerequisites.map((item) => item.id));
const officialQuestionIds = new Set(seedQuestions.map((question) => question.id));

const requiredText = (label: string, minimum = 1) =>
  z
    .string({ error: `${label} deve ser texto.` })
    .transform((value) => value.trim())
    .pipe(
      z.string().min(minimum, {
        message: `${label} deve ter pelo menos ${minimum} caractere(s).`,
      }),
    );

const optionalText = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().transform((value) => value.trim()).optional(),
);

const stringList = z
  .array(z.string({ error: "Cada item da lista deve ser texto." }), {
    error: "O campo deve ser uma lista.",
  })
  .transform((values) => values.map((value) => value.trim()).filter(Boolean));

const optionSchema = z.object({
  id: requiredText("O ID da alternativa"),
  text: requiredText("O texto da alternativa"),
  misconception: optionalText,
  prerequisiteId: optionalText,
});

const questionSchema = z
  .object({
    id: optionalText,
    courseId: z.enum(courseIds, { error: "Curso inválido." }),
    topicId: requiredText("O tópico"),
    prerequisiteIds: stringList.default([]),
    prompt: requiredText("O enunciado", 8),
    options: z
      .array(optionSchema, { error: "Alternativas devem formar uma lista." })
      .min(4, { message: "Informe pelo menos quatro alternativas." })
      .max(5, { message: "Informe no máximo cinco alternativas." }),
    correctOptionId: requiredText("O ID da alternativa correta"),
    explanation: requiredText("A explicação", 8),
    difficulty: z.enum(["basico", "medio", "avancado"], {
      error: "Dificuldade inválida: use basico, medio ou avancado.",
    }),
    errorType: requiredText("O tipo de erro", 3),
    tags: stringList.default([]),
  })
  .superRefine((question, context) => {
    if (question.id && officialQuestionIds.has(question.id)) {
      context.addIssue({
        code: "custom",
        path: ["id"],
        message: "O ID informado é reservado pelo banco oficial de questões.",
      });
    }
    const topic = topicById.get(question.topicId);
    if (!topic) {
      context.addIssue({
        code: "custom",
        path: ["topicId"],
        message: "O tópico não existe no currículo.",
      });
    } else if (topic.courseId !== question.courseId) {
      context.addIssue({
        code: "custom",
        path: ["topicId"],
        message: `O tópico ${question.topicId} não pertence ao curso ${question.courseId}.`,
      });
    }

    const seenPrerequisites = new Set<string>();
    for (const prerequisiteId of question.prerequisiteIds) {
      if (!prerequisiteIds.has(prerequisiteId)) {
        context.addIssue({
          code: "custom",
          path: ["prerequisiteIds"],
          message: `O pré-requisito ${prerequisiteId} não existe.`,
        });
      }
      if (seenPrerequisites.has(prerequisiteId)) {
        context.addIssue({
          code: "custom",
          path: ["prerequisiteIds"],
          message: `O pré-requisito ${prerequisiteId} está duplicado.`,
        });
      }
      seenPrerequisites.add(prerequisiteId);
    }

    const seenOptionIds = new Set<string>();
    for (const [index, option] of question.options.entries()) {
      if (seenOptionIds.has(option.id)) {
        context.addIssue({
          code: "custom",
          path: ["options", index, "id"],
          message: `O ID de alternativa ${option.id} está duplicado.`,
        });
      }
      seenOptionIds.add(option.id);

      if (
        option.prerequisiteId &&
        !prerequisiteIds.has(option.prerequisiteId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["options", index, "prerequisiteId"],
          message: `O pré-requisito ${option.prerequisiteId} da alternativa não existe.`,
        });
      }
    }

    const correctMatches = question.options.filter(
      (option) => option.id === question.correctOptionId,
    ).length;
    if (correctMatches !== 1) {
      context.addIssue({
        code: "custom",
        path: ["correctOptionId"],
        message: "A alternativa correta deve existir exatamente uma vez.",
      });
    }
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
    const parsed: unknown = JSON.parse(input);
    const rows = Array.isArray(parsed) ? parsed : [parsed];

    return normalizeRows(rows);
  } catch {
    return {
      questions: [],
      errors: ["JSON inválido. Verifique aspas, vírgulas e colchetes."],
    };
  }
}

function parseCsvQuestions(input: string): ImportResult {
  const parsed = parseCsvTable(input);
  if (parsed.error) {
    return { questions: [], errors: [parsed.error] };
  }

  const rows = parsed.rows.filter((row) => row.some((value) => value !== ""));
  if (rows.length < 2) {
    return {
      questions: [],
      errors: ["CSV precisa ter cabeçalho e pelo menos uma linha de questão."],
    };
  }

  const headers = rows[0].map((header, index) =>
    (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim(),
  );
  const duplicateHeaders = headers.filter(
    (header, index) => headers.indexOf(header) !== index,
  );
  if (duplicateHeaders.length > 0) {
    return {
      questions: [],
      errors: [
        `CSV possui coluna(s) repetida(s): ${[...new Set(duplicateHeaders)].join(", ")}.`,
      ],
    };
  }

  const requiredHeaders = [
    "courseId",
    "topicId",
    "prompt",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "correctOptionId",
    "explanation",
    "difficulty",
    "errorType",
  ];
  const missingHeaders = requiredHeaders.filter(
    (required) => !headers.includes(required),
  );
  if (missingHeaders.length > 0) {
    return {
      questions: [],
      errors: [`CSV sem coluna(s) obrigatória(s): ${missingHeaders.join(", ")}.`],
    };
  }

  const inconsistentRow = rows
    .slice(1)
    .findIndex((values) => values.length !== headers.length);
  if (inconsistentRow >= 0) {
    return {
      questions: [],
      errors: [
        `Linha ${inconsistentRow + 2}: esperadas ${headers.length} colunas, mas foram encontradas ${rows[inconsistentRow + 1].length}.`,
      ],
    };
  }

  const records = rows.slice(1).map((values) =>
    Object.fromEntries(
      headers.map((header, index) => [header, values[index].trim()]),
    ),
  );
  const questionRows = records.map((record) => ({
    id: record.id || undefined,
    courseId: record.courseId,
    topicId: record.topicId,
    prerequisiteIds: splitList(record.prerequisiteIds),
    prompt: record.prompt,
    options: [
      csvOption(record, "a", "A"),
      csvOption(record, "b", "B"),
      csvOption(record, "c", "C"),
      csvOption(record, "d", "D"),
      record.optionE ? csvOption(record, "e", "E") : undefined,
    ].filter((option) => option !== undefined),
    correctOptionId: record.correctOptionId,
    explanation: record.explanation,
    difficulty: record.difficulty as Difficulty,
    errorType: record.errorType,
    tags: splitList(record.tags),
  }));

  return normalizeRows(questionRows, 2);
}

function normalizeRows(rows: unknown[], firstLine = 1): ImportResult {
  const questions: Question[] = [];
  const errors: string[] = [];
  const seenQuestionIds = new Set<string>();
  const importId = Date.now().toString(36);

  rows.forEach((row, index) => {
    const line = firstLine + index;
    const result = questionSchema.safeParse(row);

    if (!result.success) {
      errors.push(
        `Linha ${line}: ${result.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      );
      return;
    }

    if (result.data.id && seenQuestionIds.has(result.data.id)) {
      errors.push(`Linha ${line}: o ID de questão ${result.data.id} está duplicado.`);
      return;
    }

    const id =
      result.data.id ?? `imported-${importId}-${index}-${result.data.topicId}`;
    seenQuestionIds.add(id);
    questions.push({ ...result.data, id });
  });

  return { questions, errors };
}

function csvOption(
  record: Record<string, string>,
  id: string,
  suffix: "A" | "B" | "C" | "D" | "E",
) {
  return {
    id,
    text: record[`option${suffix}`],
    misconception: record[`option${suffix}Misconception`] || undefined,
    prerequisiteId: record[`option${suffix}PrerequisiteId`] || undefined,
  };
}

function splitList(value: string | undefined) {
  return (value ?? "")
    .split(/[|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCsvTable(input: string): { rows: string[][]; error?: string } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field.trim() !== "") {
        return {
          rows: [],
          error: "CSV inválido: aspas devem começar no início de um campo.",
        };
      }
      quoted = true;
      continue;
    }

    if (char === ",") {
      row.push(field.trim());
      field = "";
      continue;
    }

    if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (quoted) {
    return { rows: [], error: "CSV inválido: há aspas não fechadas." };
  }

  row.push(field.trim());
  rows.push(row);
  return { rows };
}
