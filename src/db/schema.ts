import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const courseIdEnum = pgEnum("course_id", [
  "pre-calculo",
  "calculo-1",
  "calculo-2",
  "calculo-3",
  "calculo-4",
]);

export const difficultyEnum = pgEnum("difficulty", [
  "basico",
  "medio",
  "avancado",
]);

export const recommendationPriorityEnum = pgEnum("recommendation_priority", [
  "alta",
  "media",
  "baixa",
]);

export const examAttemptStatusEnum = pgEnum("exam_attempt_status", [
  "in_progress",
  "submitted",
  "expired",
  "late",
]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("student"),
  preferences: jsonb("preferences").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const courses = pgTable("courses", {
  id: courseIdEnum("id").primaryKey(),
  title: text("title").notNull(),
  shortTitle: text("short_title").notNull(),
  description: text("description").notNull(),
  order: integer("order").notNull(),
});

export const topics = pgTable("topics", {
  id: text("id").primaryKey(),
  courseId: courseIdEnum("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  order: integer("order").notNull(),
  outcomes: jsonb("outcomes").$type<string[]>().notNull().default([]),
});

export const prerequisites = pgTable("prerequisites", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  examples: jsonb("examples").$type<string[]>().notNull().default([]),
});

export const prerequisiteTopics = pgTable(
  "prerequisite_topics",
  {
    prerequisiteId: text("prerequisite_id")
      .notNull()
      .references(() => prerequisites.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.prerequisiteId, table.topicId] })],
);

export const questions = pgTable("questions", {
  id: text("id").primaryKey(),
  courseId: courseIdEnum("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  correctOptionId: text("correct_option_id").notNull(),
  explanation: text("explanation").notNull(),
  difficulty: difficultyEnum("difficulty").notNull(),
  errorType: text("error_type").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const questionOptions = pgTable(
  "question_options",
  {
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    text: text("text").notNull(),
    order: integer("order").notNull(),
    errorType: text("error_type"),
    prerequisiteId: text("prerequisite_id").references(
      () => prerequisites.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [primaryKey({ columns: [table.questionId, table.id] })],
);

export const questionPrerequisites = pgTable(
  "question_prerequisites",
  {
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    prerequisiteId: text("prerequisite_id")
      .notNull()
      .references(() => prerequisites.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.questionId, table.prerequisiteId] })],
);

export const attempts = pgTable("attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull(),
  courseId: courseIdEnum("course_id").notNull(),
  topicId: text("topic_id").notNull(),
  prerequisiteIds: jsonb("prerequisite_ids").$type<string[]>().notNull().default([]),
  selectedOptionId: text("selected_option_id").notNull(),
  correctOptionId: text("correct_option_id").notNull(),
  correct: boolean("correct").notNull(),
  timeSpentSeconds: integer("time_spent_seconds").notNull(),
  difficulty: difficultyEnum("difficulty").notNull(),
  errorType: text("error_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const importedQuestions = pgTable(
  "imported_questions",
  {
    id: text("id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    question: jsonb("question").$type<{
      id: string;
      courseId: string;
      topicId: string;
      prerequisiteIds: string[];
      prompt: string;
      options: Array<{
        id: string;
        text: string;
        misconception?: string;
        prerequisiteId?: string;
      }>;
      correctOptionId: string;
      explanation: string;
      difficulty: string;
      errorType: string;
      tags: string[];
    }>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id, table.userId] })],
);

export const recommendations = pgTable("recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  actionLabel: text("action_label").notNull(),
  courseId: courseIdEnum("course_id").notNull(),
  topicId: text("topic_id").notNull(),
  priority: recommendationPriorityEnum("priority").notNull(),
  source: text("source").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const assessmentSchedules = pgTable("assessment_schedules", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  courseId: courseIdEnum("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  questionCount: integer("question_count").notNull(),
  difficultyMix: jsonb("difficulty_mix")
    .$type<Record<string, number>>()
    .notNull()
    .default({}),
  minimumScore: integer("minimum_score").notNull().default(70),
  maxAttempts: integer("max_attempts").notNull().default(3),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  deadlinePolicy: text("deadline_policy").notNull().default("late"),
  required: boolean("required").notNull().default(true),
  active: boolean("active").notNull().default(true),
  timeSettings: jsonb("time_settings")
    .$type<Record<string, number>>()
    .notNull()
    .default({ basico: 2, medio: 4, avancado: 7 }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const officialExamAttempts = pgTable("official_exam_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  assessmentId: text("assessment_id").notNull(),
  courseId: courseIdEnum("course_id").notNull(),
  topicId: text("topic_id").notNull(),
  status: examAttemptStatusEnum("status").notNull().default("in_progress"),
  score: integer("score").notNull().default(0),
  correctCount: integer("correct_count").notNull().default(0),
  questionCount: integer("question_count").notNull().default(0),
  questionIds: jsonb("question_ids").$type<string[]>().notNull().default([]),
  timeLimitSeconds: integer("time_limit_seconds").notNull(),
  timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const officialExamAnswers = pgTable("official_exam_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => officialExamAttempts.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull(),
  courseId: courseIdEnum("course_id").notNull(),
  topicId: text("topic_id").notNull(),
  prerequisiteIds: jsonb("prerequisite_ids").$type<string[]>().notNull().default([]),
  selectedOptionId: text("selected_option_id"),
  correctOptionId: text("correct_option_id").notNull(),
  correct: boolean("correct").notNull(),
  timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
  difficulty: difficultyEnum("difficulty").notNull(),
  errorType: text("error_type").notNull(),
  answeredAt: timestamp("answered_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
