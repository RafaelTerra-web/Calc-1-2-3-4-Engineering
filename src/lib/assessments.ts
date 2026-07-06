import { getTopic } from "@/lib/curriculum";
import type {
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

export const DEFAULT_REFERENCE_DATE = "2026-07-06T00:00:00-03:00";

export const officialAssessments: OfficialAssessment[] = [
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
    availableAt: "2026-07-06T00:00:00-03:00",
    dueAt: "2026-07-14T23:59:00-03:00",
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
    availableAt: "2026-07-06T00:00:00-03:00",
    dueAt: "2026-07-20T23:59:00-03:00",
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
    availableAt: "2026-07-10T00:00:00-03:00",
    dueAt: "2026-07-27T23:59:00-03:00",
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
    availableAt: "2026-07-17T00:00:00-03:00",
    dueAt: "2026-08-03T23:59:00-03:00",
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
    availableAt: "2026-07-24T00:00:00-03:00",
    dueAt: "2026-08-10T23:59:00-03:00",
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
    availableAt: "2026-07-31T00:00:00-03:00",
    dueAt: "2026-08-17T23:59:00-03:00",
    deadlinePolicy: "available",
    required: true,
  },
];

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
) {
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
      ),
    );
  }

  if (selected.length < assessment.questionCount) {
    selected.push(
      ...takeQuestions(
        topicQuestions.filter(
          (question) => !selected.some((item) => item.id === question.id),
        ),
        assessment.questionCount - selected.length,
        recentlySeenQuestionIds,
      ),
    );
  }

  if (selected.length < assessment.questionCount) {
    selected.push(
      ...takeQuestions(
        questions.filter(
          (question) =>
            question.courseId === assessment.courseId &&
            !selected.some((item) => item.id === question.id),
        ),
        assessment.questionCount - selected.length,
        recentlySeenQuestionIds,
      ),
    );
  }

  return selected.slice(0, assessment.questionCount);
}

export function buildOfficialExamStats(
  assessments: OfficialAssessment[],
  attempts: ExamAttempt[],
  referenceDate = DEFAULT_REFERENCE_DATE,
): OfficialExamStats {
  const submittedAttempts = attempts
    .filter(
      (attempt) =>
        attempt.status === "submitted" ||
        attempt.status === "late" ||
        attempt.status === "expired",
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
  const now = new Date(referenceDate).getTime();
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
  referenceDate = DEFAULT_REFERENCE_DATE,
) {
  const submitted = attempts.some(
    (attempt) =>
      attempt.assessmentId === assessment.id &&
      (attempt.status === "submitted" ||
        attempt.status === "late" ||
        attempt.status === "expired"),
  );

  if (submitted) {
    return "entregue";
  }

  const now = new Date(referenceDate).getTime();
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
) {
  const fresh = shuffleQuestions(
    questions.filter((question) => !recentlySeenQuestionIds.has(question.id)),
  );
  const repeated = shuffleQuestions(
    questions.filter((question) => recentlySeenQuestionIds.has(question.id)),
  );

  return [...fresh, ...repeated].slice(0, amount);
}

function shuffleQuestions(questions: Question[]) {
  return [...questions].sort(() => Math.random() - 0.5);
}
