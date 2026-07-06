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
  const attemptsByCourse = new Map<CourseId, Attempt[]>();
  const attemptsByTopic = new Map<string, Attempt[]>();
  const attemptsByPrerequisite = new Map<string, Attempt[]>();

  for (const attempt of attempts) {
    attemptsByCourse.set(attempt.courseId, [
      ...(attemptsByCourse.get(attempt.courseId) ?? []),
      attempt,
    ]);
    attemptsByTopic.set(attempt.topicId, [
      ...(attemptsByTopic.get(attempt.topicId) ?? []),
      attempt,
    ]);

    for (const prerequisiteId of attempt.prerequisiteIds) {
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
      (topic) => (attemptsByTopic.get(topic.id) ?? []).length > 0,
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
  const topicQuestionIds = new Set(
    questions
      .filter((question) => question.topicId === topicId)
      .map((question) => question.id),
  );
  const answeredQuestionIds = new Set(
    attempts
      .filter((attempt) => topicQuestionIds.has(attempt.questionId))
      .map((attempt) => attempt.questionId),
  );

  return {
    total: topicQuestionIds.size,
    answered: answeredQuestionIds.size,
    percent:
      topicQuestionIds.size === 0
        ? 0
        : Math.round((answeredQuestionIds.size / topicQuestionIds.size) * 100),
  };
}
