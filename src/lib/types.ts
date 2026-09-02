export type CourseId =
  | "pre-calculo"
  | "calculo-1"
  | "calculo-2"
  | "calculo-3"
  | "calculo-4";

export type Difficulty = "basico" | "medio" | "avancado";

export type VideoKind = "practice" | "theory" | "prerequisite";

export type UserRole = "student" | "admin";

export type AssessmentScope = "topic" | "module" | "course" | "scheduled";

export type DeadlinePolicy = "expire" | "late" | "available";

export type ExamAttemptStatus = "in_progress" | "submitted" | "expired" | "late";

export type AssessmentNotificationTone = "info" | "warning" | "danger";

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
  /** Diagnóstico específico exibido/registrado quando este distrator é escolhido. */
  misconception?: string;
  /** Pré-requisito realmente associado ao erro deste distrator. */
  prerequisiteId?: string;
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

export type VideoResource = {
  id: string;
  kind: VideoKind;
  title: string;
  channel: string;
  description: string;
  youtubeUrl: string;
  embedUrl: string;
  sourcePlaylistTitle: string;
  sourcePlaylistUrl?: string;
  viewCount?: number;
  publishedAt?: string;
  questionIds?: string[];
  topicIds?: string[];
  prerequisiteIds?: string[];
};

export type QuestionVideos = {
  practice: VideoResource[];
  theory: VideoResource[];
  prerequisite: VideoResource[];
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
  /** Permite combinar treino e prova no mesmo diagnóstico formativo. */
  source?: "practice" | "official_exam";
  /** Provas expiradas ficam no histórico, mas não medem aprendizagem. */
  assessmentStatus?: ExamAttemptStatus;
};

export type StudyUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

export type PracticeSessionAnswer = {
  questionId: string;
  courseId: CourseId;
  topicId: string;
  selectedOptionId: string;
  correctOptionId: string;
  correct: boolean;
  errorType: string;
};

export type PracticeSessionSummary = {
  id: string;
  courseId: CourseId;
  topicId: string;
  total: number;
  correct: number;
  completedAt: string;
};

export type DifficultyTimeSettings = Record<Difficulty, number>;

export type DifficultyMix = Partial<Record<Difficulty, number>>;

export type OfficialAssessment = {
  id: string;
  title: string;
  description: string;
  courseId: CourseId;
  topicId: string;
  scope: AssessmentScope;
  questionCount: number;
  difficultyMix: DifficultyMix;
  minimumScore: number;
  maxAttempts: number;
  availableAt: string;
  dueAt: string;
  deadlinePolicy: DeadlinePolicy;
  required: boolean;
};

export type ExamAttempt = {
  id: string;
  assessmentId: string;
  courseId: CourseId;
  topicId: string;
  status: ExamAttemptStatus;
  score: number;
  correctCount: number;
  questionCount: number;
  timeLimitSeconds: number;
  timeSpentSeconds: number;
  questionIds: string[];
  startedAt: string;
  submittedAt: string | null;
  createdAt: string;
};

export type OfficialExamStats = {
  submittedAttempts: ExamAttempt[];
  averageScore: number;
  bestScore: number;
  completedAssessments: number;
  totalAssessments: number;
  nextAssessment: OfficialAssessment | null;
  overdueAssessments: OfficialAssessment[];
};

export type AssessmentNotification = {
  id: string;
  assessmentId: string;
  title: string;
  message: string;
  daysUntilDue: number;
  dueAt: string;
  tone: AssessmentNotificationTone;
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
