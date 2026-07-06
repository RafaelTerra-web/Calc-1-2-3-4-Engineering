export type CourseId =
  | "pre-calculo"
  | "calculo-1"
  | "calculo-2"
  | "calculo-3"
  | "calculo-4";

export type Difficulty = "basico" | "medio" | "avancado";

export type Course = {
  id: CourseId;
  title: string;
  shortTitle: string;
  description: string;
  accent: string;
};

export type Topic = {
  id: string;
  courseId: CourseId;
  title: string;
  description: string;
  order: number;
  outcomes: string[];
};

export type Prerequisite = {
  id: string;
  title: string;
  description: string;
  examples: string[];
  topicIds: string[];
};

export type QuestionOption = {
  id: string;
  text: string;
};

export type Question = {
  id: string;
  courseId: CourseId;
  topicId: string;
  prerequisiteIds: string[];
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;
  difficulty: Difficulty;
  errorType: string;
  tags: string[];
};

export type Attempt = {
  id: string;
  questionId: string;
  courseId: CourseId;
  topicId: string;
  prerequisiteIds: string[];
  selectedOptionId: string;
  correctOptionId: string;
  correct: boolean;
  timeSpentSeconds: number;
  difficulty: Difficulty;
  errorType: string;
  createdAt: string;
};

export type StudyUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type CourseStats = {
  courseId: CourseId;
  attempts: number;
  correct: number;
  accuracy: number;
  completedTopics: number;
  totalTopics: number;
};

export type TopicStats = {
  topicId: string;
  courseId: CourseId;
  attempts: number;
  correct: number;
  accuracy: number;
  recentMisses: number;
  weak: boolean;
};

export type PrerequisiteStats = {
  prerequisiteId: string;
  attempts: number;
  correct: number;
  accuracy: number;
  weak: boolean;
};

export type Recommendation = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  courseId: CourseId;
  topicId: string;
  priority: "alta" | "media" | "baixa";
};

export type Diagnostics = {
  totalAttempts: number;
  totalCorrect: number;
  accuracy: number;
  averageTimeSeconds: number;
  weakTopics: TopicStats[];
  weakPrerequisites: PrerequisiteStats[];
  courseStats: CourseStats[];
  topicStats: TopicStats[];
  prerequisiteStats: PrerequisiteStats[];
  recentMistakes: Attempt[];
  recommendations: Recommendation[];
};
