import { getTopic } from "@/lib/curriculum";
import type {
  AssessmentNotification,
  Difficulty,
  DifficultyTimeSettings,
  ExamAttempt,
  OfficialAssessment,
  OfficialExamStats,
  Question,
} from "@/lib/types";

export const DEFAULT_DIFFICULTY_TIME_MINUTES: DifficultyTimeSettings = {
  basico: 2,
  medio: 4,
  avancado: 7,
};

/** Mantido para consumidores antigos; representa o instante real de carga. */
export const DEFAULT_REFERENCE_DATE = new Date().toISOString();

type AssessmentTemplate = Omit<
  OfficialAssessment,
  "availableAt" | "dueAt"
> & {
  availableAfterDays: number;
  dueAfterDays: number;
};

const assessmentTemplates: AssessmentTemplate[] = [
  {
    id: "exam-pre-fatoracao",
    title: "Prova temática: Fatoração",
    description: "Avalia produtos notáveis, diferença de quadrados e simplificação.",
    courseId: "pre-calculo",
    topicId: "fatoracao",
    scope: "topic",
    questionCount: 4,
    difficultyMix: { basico: 3, medio: 1 },
    minimumScore: 70,
    maxAttempts: 3,
    availableAfterDays: 0,
    dueAfterDays: 8,
    deadlinePolicy: "late",
    required: true,
  },
  {
    id: "exam-c1-limites",
    title: "Prova temática: Limites",
    description: "Foca em limites por álgebra, fatoração e interpretação.",
    courseId: "calculo-1",
    topicId: "limites",
    scope: "topic",
    questionCount: 5,
    difficultyMix: { basico: 2, medio: 2, avancado: 1 },
    minimumScore: 70,
    maxAttempts: 3,
    availableAfterDays: 0,
    dueAfterDays: 14,
    deadlinePolicy: "late",
    required: true,
  },
  {
    id: "exam-c1-derivadas",
    title: "Prova temática: Derivadas",
    description: "Regras de derivação, cadeia e leitura de taxa de variação.",
    courseId: "calculo-1",
    topicId: "derivadas",
    scope: "topic",
    questionCount: 5,
    difficultyMix: { basico: 2, medio: 2, avancado: 1 },
    minimumScore: 70,
    maxAttempts: 3,
    availableAfterDays: 4,
    dueAfterDays: 21,
    deadlinePolicy: "late",
    required: true,
  },
  {
    id: "exam-c2-tecnicas",
    title: "Prova de módulo: Técnicas de integração",
    description: "Escolha de técnica, integração por partes e frações parciais.",
    courseId: "calculo-2",
    topicId: "tecnicas-integracao",
    scope: "module",
    questionCount: 6,
    difficultyMix: { basico: 2, medio: 3, avancado: 1 },
    minimumScore: 70,
    maxAttempts: 2,
    availableAfterDays: 11,
    dueAfterDays: 28,
    deadlinePolicy: "available",
    required: true,
  },
  {
    id: "exam-c3-parciais",
    title: "Prova de módulo: Derivadas parciais",
    description: "Gradiente, plano tangente e regra da cadeia em várias variáveis.",
    courseId: "calculo-3",
    topicId: "derivadas-parciais",
    scope: "module",
    questionCount: 6,
    difficultyMix: { basico: 2, medio: 2, avancado: 2 },
    minimumScore: 70,
    maxAttempts: 2,
    availableAfterDays: 18,
    dueAfterDays: 35,
    deadlinePolicy: "available",
    required: true,
  },
  {
    id: "exam-c4-campos",
    title: "Prova de módulo: Campos vetoriais",
    description: "Divergente, rotacional e leitura geométrica de campos.",
    courseId: "calculo-4",
    topicId: "campos-vetoriais",
    scope: "module",
    questionCount: 6,
    difficultyMix: { basico: 2, medio: 2, avancado: 2 },
    minimumScore: 70,
    maxAttempts: 2,
    availableAfterDays: 25,
    dueAfterDays: 42,
    deadlinePolicy: "available",
    required: true,
  },
];

/**
 * Gera um calendário relativo ao início da oferta da turma.
 * A data de referência é tratada como dia civil local, evitando um semestre
 * preso a datas antigas e preservando as janelas originalmente planejadas.
 */
export function createDefaultAssessments(reference: Date = new Date()) {
  const referenceDay = startOfLocalDay(reference);

  return assessmentTemplates.map(
    ({ availableAfterDays, dueAfterDays, ...assessment }) => ({
      ...assessment,
      availableAt: addLocalDays(referenceDay, availableAfterDays, false),
      dueAt: addLocalDays(referenceDay, dueAfterDays, true),
    }),
  );
}

export const officialAssessments: OfficialAssessment[] =
  createDefaultAssessments();

export function getAssessment(id: string) {
  return officialAssessments.find((assessment) => assessment.id === id);
}

export function calculateTimeLimitSeconds(
  questions: Question[],
  settings: DifficultyTimeSettings = DEFAULT_DIFFICULTY_TIME_MINUTES,
) {
  const baseMinutes = questions.reduce(
    (total, question) => total + settings[question.difficulty],
    0,
  );
  const hasAdvancedContext = questions.some(
    (question) =>
      question.courseId === "calculo-3" ||
      question.courseId === "calculo-4" ||
      question.difficulty === "avancado",
  );
  const withBonus = hasAdvancedContext
    ? Math.ceil(baseMinutes * 1.15)
    : baseMinutes;

  return Math.max(15, withBonus) * 60;
}

export function selectAssessmentQuestions(
  assessment: OfficialAssessment,
  questions: Question[],
  recentlySeenQuestionIds = new Set<string>(),
  random: () => number = Math.random,
) {
  const validation = validateAssessmentQuestionPool(assessment, questions);
  if (!validation.valid) {
    return [];
  }

  const topicQuestions = questions.filter(
    (question) =>
      question.courseId === assessment.courseId &&
      question.topicId === assessment.topicId,
  );
  const selected: Question[] = [];

  for (const difficulty of ["basico", "medio", "avancado"] satisfies Difficulty[]) {
    const requested = assessment.difficultyMix[difficulty] ?? 0;
    if (requested === 0) {
      continue;
    }

    selected.push(
      ...takeQuestions(
        topicQuestions.filter((question) => question.difficulty === difficulty),
        requested,
        recentlySeenQuestionIds,
        random,
      ),
    );
  }

  return shuffleQuestions(selected, random);
}

export type AssessmentPoolValidation = {
  valid: boolean;
  errors: string[];
  availableByDifficulty: Record<Difficulty, number>;
};

/** Explica por que uma prova pode ou não ser montada sem fugir do tópico. */
export function validateAssessmentQuestionPool(
  assessment: OfficialAssessment,
  questions: Question[],
): AssessmentPoolValidation {
  const topicQuestions = questions.filter(
    (question) =>
      question.courseId === assessment.courseId &&
      question.topicId === assessment.topicId,
  );
  const availableByDifficulty: Record<Difficulty, number> = {
    basico: 0,
    medio: 0,
    avancado: 0,
  };

  for (const question of topicQuestions) {
    availableByDifficulty[question.difficulty] += 1;
  }

  const errors: string[] = [];
  const requestedTotal = (
    ["basico", "medio", "avancado"] satisfies Difficulty[]
  ).reduce(
    (total, difficulty) => total + (assessment.difficultyMix[difficulty] ?? 0),
    0,
  );

  if (requestedTotal !== assessment.questionCount) {
    errors.push(
      `O mix de dificuldade soma ${requestedTotal}, mas a avaliação exige ${assessment.questionCount} questões.`,
    );
  }

  for (const difficulty of ["basico", "medio", "avancado"] satisfies Difficulty[]) {
    const requested = assessment.difficultyMix[difficulty] ?? 0;
    const available = availableByDifficulty[difficulty];
    if (available < requested) {
      errors.push(
        `Há ${available} questão(ões) de nível ${difficulty}, mas o mix exige ${requested}.`,
      );
    }
  }

  if (topicQuestions.length < assessment.questionCount) {
    errors.push(
      `O tópico possui ${topicQuestions.length} questão(ões), abaixo das ${assessment.questionCount} exigidas.`,
    );
  }

  return { valid: errors.length === 0, errors, availableByDifficulty };
}

export function buildOfficialExamStats(
  assessments: OfficialAssessment[],
  attempts: ExamAttempt[],
  referenceDate: string | Date = new Date(),
): OfficialExamStats {
  const submittedAttempts = attempts
    .filter(
      (attempt) =>
        attempt.status === "submitted" ||
        attempt.status === "late",
    )
    .sort(
      (left, right) =>
        new Date(right.submittedAt ?? right.createdAt).getTime() -
        new Date(left.submittedAt ?? left.createdAt).getTime(),
    );
  const averageScore =
    submittedAttempts.length === 0
      ? 0
      : Math.round(
          submittedAttempts.reduce((total, attempt) => total + attempt.score, 0) /
            submittedAttempts.length,
        );
  const bestScore =
    submittedAttempts.length === 0
      ? 0
      : Math.max(...submittedAttempts.map((attempt) => attempt.score));
  const completedAssessmentIds = new Set(
    submittedAttempts.map((attempt) => attempt.assessmentId),
  );
  const now = toDate(referenceDate).getTime();
  const availableOrUpcoming = assessments
    .filter((assessment) => !completedAssessmentIds.has(assessment.id))
    .sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime());
  const nextAssessment =
    availableOrUpcoming.find(
      (assessment) => assessment.deadlinePolicy !== "expire" || new Date(assessment.dueAt).getTime() >= now,
    ) ?? null;
  const overdueAssessments = availableOrUpcoming.filter(
    (assessment) => new Date(assessment.dueAt).getTime() < now,
  );

  return {
    submittedAttempts,
    averageScore,
    bestScore,
    completedAssessments: completedAssessmentIds.size,
    totalAssessments: assessments.length,
    nextAssessment,
    overdueAssessments,
  };
}

export function getAssessmentStatusLabel(
  assessment: OfficialAssessment,
  attempts: ExamAttempt[],
  referenceDate: string | Date = new Date(),
) {
  const submitted = attempts.some(
    (attempt) =>
      attempt.assessmentId === assessment.id &&
      (attempt.status === "submitted" ||
        attempt.status === "late"),
  );

  if (submitted) {
    return "entregue";
  }

  const now = toDate(referenceDate).getTime();
  const availableAt = new Date(assessment.availableAt).getTime();
  const dueAt = new Date(assessment.dueAt).getTime();

  if (now < availableAt) {
    return "programada";
  }

  if (now > dueAt) {
    return assessment.deadlinePolicy === "expire" ? "expirada" : "atrasada";
  }

  return "disponível";
}

export function buildAssessmentNotifications(
  assessments: OfficialAssessment[],
  attempts: ExamAttempt[],
  referenceDate: string | Date = new Date(),
): AssessmentNotification[] {
  const completedAssessmentIds = new Set(
    attempts
      .filter(
        (attempt) =>
          attempt.status === "submitted" ||
          attempt.status === "late",
      )
      .map((attempt) => attempt.assessmentId),
  );

  return assessments
    .filter((assessment) => !completedAssessmentIds.has(assessment.id))
    .map((assessment) => {
      const daysUntilDue = getCalendarDayDistance(referenceDate, assessment.dueAt);
      const status = getAssessmentStatusLabel(assessment, attempts, referenceDate);
      const tone: AssessmentNotification["tone"] =
        status === "expirada" || status === "atrasada"
          ? "danger"
          : daysUntilDue <= 1
            ? "warning"
            : "info";

      return {
        id: `assessment-notification-${assessment.id}`,
        assessmentId: assessment.id,
        title: assessment.title,
        message: buildAssessmentNotificationMessage(
          assessment,
          daysUntilDue,
          status,
        ),
        daysUntilDue,
        dueAt: assessment.dueAt,
        tone,
      };
    })
    .sort(
      (left, right) =>
        left.daysUntilDue - right.daysUntilDue ||
        new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime(),
    );
}

export function formatAssessmentWindow(assessment: OfficialAssessment) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${formatter.format(new Date(assessment.availableAt))} até ${formatter.format(
    new Date(assessment.dueAt),
  )}`;
}

export function formatAssessmentDueDate(assessment: OfficialAssessment) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(assessment.dueAt));
}

export function describeAssessmentScope(assessment: OfficialAssessment) {
  const topic = getTopic(assessment.topicId);
  const scopeLabels: Record<OfficialAssessment["scope"], string> = {
    topic: "Tópico",
    module: "Módulo",
    course: "Curso",
    scheduled: "Agendada",
  };

  return `${scopeLabels[assessment.scope]}${topic ? ` · ${topic.title}` : ""}`;
}

function takeQuestions(
  questions: Question[],
  amount: number,
  recentlySeenQuestionIds: Set<string>,
  random: () => number,
) {
  const fresh = shuffleQuestions(
    questions.filter((question) => !recentlySeenQuestionIds.has(question.id)),
    random,
  );
  const repeated = shuffleQuestions(
    questions.filter((question) => recentlySeenQuestionIds.has(question.id)),
    random,
  );

  return [...fresh, ...repeated].slice(0, amount);
}

function buildAssessmentNotificationMessage(
  assessment: OfficialAssessment,
  daysUntilDue: number,
  status: string,
) {
  if (status === "expirada") {
    return `A ${assessment.title} expirou.`;
  }

  if (status === "atrasada") {
    const daysLate = Math.abs(daysUntilDue);
    return daysLate <= 1
      ? `A ${assessment.title} está atrasada desde ontem.`
      : `A ${assessment.title} está atrasada há ${daysLate} dias.`;
  }

  if (daysUntilDue <= 0) {
    return `A ${assessment.title} vence hoje.`;
  }

  if (daysUntilDue === 1) {
    return `Falta 1 dia para a ${assessment.title}.`;
  }

  return `Faltam ${daysUntilDue} dias para a ${assessment.title}.`;
}

function getCalendarDayDistance(
  referenceDate: string | Date,
  targetDate: string | Date,
) {
  const reference = toDate(referenceDate);
  const target = toDate(targetDate);
  const referenceDay = Date.UTC(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  );
  const targetDay = Date.UTC(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );

  return Math.round((targetDay - referenceDay) / (24 * 60 * 60 * 1000));
}

/** Fisher–Yates imparcial, com fonte aleatória injetável para testes. */
export function shuffleQuestions<T>(
  questions: readonly T[],
  random: () => number = Math.random,
) {
  const shuffled = [...questions];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new RangeError("A fonte aleatória deve retornar um número em [0, 1).");
    }

    const swapIndex = Math.floor(sample * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function startOfLocalDay(reference: Date) {
  const date = new Date(reference);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("A data de referência da avaliação é inválida.");
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function toDate(value: string | Date) {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function addLocalDays(reference: Date, amount: number, endOfDay: boolean) {
  const date = new Date(reference);
  date.setDate(date.getDate() + amount);
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, 0, 0);
  return date.toISOString();
}
