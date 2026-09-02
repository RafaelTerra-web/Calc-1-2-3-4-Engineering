import {
  courses,
  getTopic,
  prerequisites,
  topics,
} from "@/lib/curriculum";
import type {
  Attempt,
  CourseId,
  CourseStats,
  Diagnostics,
  PrerequisiteStats,
  Question,
  Recommendation,
  TopicStats,
} from "@/lib/types";

const MIN_ATTEMPTS_FOR_WEAK_SIGNAL = 3;
const WEAK_ACCURACY_THRESHOLD = 0.7;
const MASTERY_ACCURACY_THRESHOLD = 0.7;
const MASTERY_QUESTION_COVERAGE = 0.5;

function safeAccuracy(correct: number, attempts: number) {
  return attempts === 0 ? 0 : correct / attempts;
}

function isRecentWeak(attempts: Attempt[]) {
  if (attempts.length < MIN_ATTEMPTS_FOR_WEAK_SIGNAL) {
    return false;
  }

  return attempts
    .slice(0, MIN_ATTEMPTS_FOR_WEAK_SIGNAL)
    .every((attempt) => !attempt.correct);
}

function sortAttemptsNewestFirst(attempts: Attempt[]) {
  return [...attempts].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function buildDiagnostics(
  questions: Question[],
  attempts: Attempt[],
): Diagnostics {
  // Tentativas expiradas continuam disponíveis no histórico operacional, mas
  // não entram em nota, domínio ou recomendação pedagógica.
  attempts = attempts.filter(
    (attempt) => attempt.assessmentStatus !== "expired",
  );
  const attemptsByCourse = new Map<CourseId, Attempt[]>();
  const attemptsByTopic = new Map<string, Attempt[]>();
  const attemptsByPrerequisite = new Map<string, Attempt[]>();
  const knownPrerequisiteIds = new Set(prerequisites.map((item) => item.id));

  for (const attempt of attempts) {
    attemptsByCourse.set(attempt.courseId, [
      ...(attemptsByCourse.get(attempt.courseId) ?? []),
      attempt,
    ]);
    attemptsByTopic.set(attempt.topicId, [
      ...(attemptsByTopic.get(attempt.topicId) ?? []),
      attempt,
    ]);

    // O diagnóstico de base considera apenas o pré-requisito realmente
    // atribuído ao distrator escolhido, sem inferir todos os vínculos da questão.
    for (const prerequisiteId of new Set(attempt.prerequisiteIds)) {
      if (!knownPrerequisiteIds.has(prerequisiteId)) {
        continue;
      }
      attemptsByPrerequisite.set(prerequisiteId, [
        ...(attemptsByPrerequisite.get(prerequisiteId) ?? []),
        attempt,
      ]);
    }
  }

  const courseStats: CourseStats[] = courses.map((course) => {
    const courseAttempts = attemptsByCourse.get(course.id) ?? [];
    const correct = courseAttempts.filter((attempt) => attempt.correct).length;
    const courseTopics = topics.filter((topic) => topic.courseId === course.id);
    const completedTopics = courseTopics.filter(
      (topic) =>
        getTopicMastery(questions, attemptsByTopic.get(topic.id) ?? [], topic.id)
          .mastered,
    ).length;

    return {
      courseId: course.id,
      attempts: courseAttempts.length,
      correct,
      accuracy: safeAccuracy(correct, courseAttempts.length),
      completedTopics,
      totalTopics: courseTopics.length,
    };
  });

  const topicStats: TopicStats[] = topics.map((topic) => {
    const topicAttempts = sortAttemptsNewestFirst(
      attemptsByTopic.get(topic.id) ?? [],
    );
    const correct = topicAttempts.filter((attempt) => attempt.correct).length;
    const accuracy = safeAccuracy(correct, topicAttempts.length);
    const recentMisses = topicAttempts
      .slice(0, MIN_ATTEMPTS_FOR_WEAK_SIGNAL)
      .filter((attempt) => !attempt.correct).length;

    return {
      topicId: topic.id,
      courseId: topic.courseId,
      attempts: topicAttempts.length,
      correct,
      accuracy,
      recentMisses,
      weak:
        topicAttempts.length >= MIN_ATTEMPTS_FOR_WEAK_SIGNAL &&
        (accuracy < WEAK_ACCURACY_THRESHOLD || isRecentWeak(topicAttempts)),
    };
  });

  const prerequisiteStats: PrerequisiteStats[] = prerequisites.map(
    (prerequisite) => {
      const prerequisiteAttempts = sortAttemptsNewestFirst(
        attemptsByPrerequisite.get(prerequisite.id) ?? [],
      );
      const correct = prerequisiteAttempts.filter(
        (attempt) => attempt.correct,
      ).length;
      const accuracy = safeAccuracy(correct, prerequisiteAttempts.length);

      return {
        prerequisiteId: prerequisite.id,
        attempts: prerequisiteAttempts.length,
        correct,
        accuracy,
        weak:
          prerequisiteAttempts.length >= MIN_ATTEMPTS_FOR_WEAK_SIGNAL &&
          (accuracy < WEAK_ACCURACY_THRESHOLD ||
            isRecentWeak(prerequisiteAttempts)),
      };
    },
  );

  const weakTopics = topicStats
    .filter((stat) => stat.weak)
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);

  const weakPrerequisites = prerequisiteStats
    .filter((stat) => stat.weak)
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);

  const recentMistakes = sortAttemptsNewestFirst(attempts)
    .filter((attempt) => !attempt.correct)
    .slice(0, 6);

  const totalCorrect = attempts.filter((attempt) => attempt.correct).length;
  const averageTimeSeconds =
    attempts.length === 0
      ? 0
      : Math.round(
          attempts.reduce(
            (total, attempt) => total + attempt.timeSpentSeconds,
            0,
          ) / attempts.length,
        );

  return {
    totalAttempts: attempts.length,
    totalCorrect,
    accuracy: safeAccuracy(totalCorrect, attempts.length),
    averageTimeSeconds,
    weakTopics,
    weakPrerequisites,
    courseStats,
    topicStats,
    prerequisiteStats,
    recentMistakes,
    recommendations: buildRecommendations(
      questions,
      weakTopics,
      weakPrerequisites,
      attempts,
    ),
  };
}

function buildRecommendations(
  questions: Question[],
  weakTopics: TopicStats[],
  weakPrerequisites: PrerequisiteStats[],
  attempts: Attempt[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const attemptedQuestionIds = new Set(attempts.map((attempt) => attempt.questionId));

  for (const weakTopic of weakTopics.slice(0, 3)) {
    const topic = getTopic(weakTopic.topicId);
    if (!topic) {
      continue;
    }

    recommendations.push({
      id: `topic-${weakTopic.topicId}`,
      title: `Revisar ${topic.title}`,
      description: `Sua taxa neste tópico está em ${Math.round(
        weakTopic.accuracy * 100,
      )}%. Refaça questões básicas antes de voltar aos exercícios médios.`,
      actionLabel: "Praticar tópico",
      courseId: topic.courseId,
      topicId: topic.id,
      priority: "alta",
    });
  }

  for (const weakPrerequisite of weakPrerequisites.slice(0, 2)) {
    const prerequisite = prerequisites.find(
      (item) => item.id === weakPrerequisite.prerequisiteId,
    );
    const firstTopic = prerequisite?.topicIds
      .map((topicId) => getTopic(topicId))
      .find(Boolean);

    if (!prerequisite || !firstTopic) {
      continue;
    }

    recommendations.push({
      id: `pre-${weakPrerequisite.prerequisiteId}`,
      title: `Voltar para ${prerequisite.title}`,
      description: `Esse pré-requisito apareceu em erros recentes. Reforce a base antes de insistir nas questões avançadas.`,
      actionLabel: "Revisar base",
      courseId: firstTopic.courseId,
      topicId: firstTopic.id,
      priority: "media",
    });
  }

  if (recommendations.length === 0) {
    const latestMistake = sortAttemptsNewestFirst(attempts).find(
      (attempt) => !attempt.correct,
    );
    const mistakenTopic = latestMistake
      ? getTopic(latestMistake.topicId)
      : undefined;

    if (latestMistake && mistakenTopic) {
      recommendations.push({
        id: `retry-${latestMistake.questionId}`,
        title: `Retomar ${mistakenTopic.title}`,
        description:
          "Uma resposta recente indicou dúvida. Revise a explicação e resolva uma questão diferente do mesmo tópico.",
        actionLabel: "Tentar novamente",
        courseId: mistakenTopic.courseId,
        topicId: mistakenTopic.id,
        priority: "media",
      });
    }
  }

  if (recommendations.length === 0) {
    const firstUnanswered =
      questions.find((question) => !attemptedQuestionIds.has(question.id)) ??
      questions[0];

    if (firstUnanswered) {
      const topic = getTopic(firstUnanswered.topicId);
      recommendations.push({
        id: `start-${firstUnanswered.id}`,
        title: topic ? `Começar por ${topic.title}` : "Começar prática",
        description:
          "Responda algumas questões para o painel identificar seus pontos fortes e fracos.",
        actionLabel: "Resolver agora",
        courseId: firstUnanswered.courseId,
        topicId: firstUnanswered.topicId,
        priority: "baixa",
      });
    }
  }

  return recommendations.slice(0, 5);
}

export function getQuestionProgress(
  questions: Question[],
  attempts: Attempt[],
  topicId: string,
) {
  const mastery = getTopicMastery(questions, attempts, topicId);

  return {
    total: mastery.totalQuestions,
    // Nome mantido para a UI existente; agora significa questões únicas acertadas.
    answered: mastery.uniqueCorrect,
    attempted: mastery.uniqueAttempted,
    requiredCorrect: mastery.requiredCorrect,
    mastered: mastery.mastered,
    percent:
      mastery.totalQuestions === 0
        ? 0
        : Math.round(
            (mastery.uniqueCorrect / mastery.totalQuestions) * 100,
          ),
  };
}

/**
 * Domínio de um tópico exige cobertura de questões distintas e desempenho
 * consistente; repetir uma única questão não conclui todo o conteúdo.
 */
export function getTopicMastery(
  questions: Question[],
  attempts: Attempt[],
  topicId: string,
) {
  const topicQuestionIds = new Set(
    questions
      .filter((question) => question.topicId === topicId)
      .map((question) => question.id),
  );
  const topicAttempts = attempts.filter((attempt) =>
    topicQuestionIds.has(attempt.questionId) &&
    attempt.assessmentStatus !== "expired",
  );
  const attemptedQuestionIds = new Set(
    topicAttempts.map((attempt) => attempt.questionId),
  );
  const correctQuestionIds = new Set(
    topicAttempts
      .filter((attempt) => attempt.correct)
      .map((attempt) => attempt.questionId),
  );
  const totalQuestions = topicQuestionIds.size;
  const requiredCorrect =
    totalQuestions === 0
      ? 0
      : Math.min(
          totalQuestions,
          Math.max(1, Math.ceil(totalQuestions * MASTERY_QUESTION_COVERAGE)),
        );
  const correctAttempts = topicAttempts.filter(
    (attempt) => attempt.correct,
  ).length;
  const accuracy = safeAccuracy(correctAttempts, topicAttempts.length);

  return {
    totalQuestions,
    uniqueAttempted: attemptedQuestionIds.size,
    uniqueCorrect: correctQuestionIds.size,
    requiredCorrect,
    accuracy,
    mastered:
      totalQuestions > 0 &&
      correctQuestionIds.size >= requiredCorrect &&
      accuracy >= MASTERY_ACCURACY_THRESHOLD,
  };
}
