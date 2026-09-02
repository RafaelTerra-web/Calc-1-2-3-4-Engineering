import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { officialAssessments } from "../src/lib/assessments";
import {
  courses,
  prerequisites,
  seedQuestions,
  topics,
} from "../src/lib/curriculum";

const initialEmail = process.env.INITIAL_USER_EMAIL?.trim().toLowerCase();
const initialName = process.env.INITIAL_USER_NAME?.trim() || "Administrador";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const requestedInitialPassword = process.env.INITIAL_USER_PASSWORD;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const generatedInitialPassword = `${randomBytes(18).toString("base64url")}A1!`;

async function upsertAcademicContent() {
  const { error: coursesError } = await supabase.from("courses").upsert(
    courses.map((course, index) => ({
      id: course.id,
      title: course.title,
      short_title: course.shortTitle,
      description: course.description,
      order: index + 1,
    })),
  );

  if (coursesError) {
    throw coursesError;
  }

  const { error: topicsError } = await supabase.from("topics").upsert(
    topics.map((topic) => ({
      id: topic.id,
      course_id: topic.courseId,
      title: topic.title,
      description: topic.description,
      order: topic.order,
      outcomes: topic.outcomes,
    })),
  );

  if (topicsError) {
    throw topicsError;
  }

  const { error: prerequisitesError } = await supabase
    .from("prerequisites")
    .upsert(
      prerequisites.map((prerequisite) => ({
        id: prerequisite.id,
        title: prerequisite.title,
        description: prerequisite.description,
        examples: prerequisite.examples,
      })),
    );

  if (prerequisitesError) {
    throw prerequisitesError;
  }

  const prerequisiteTopicRows = prerequisites.flatMap((prerequisite) =>
    prerequisite.topicIds.map((topicId) => ({
      prerequisite_id: prerequisite.id,
      topic_id: topicId,
    })),
  );

  const { error: prerequisiteTopicsError } = await supabase
    .from("prerequisite_topics")
    .upsert(prerequisiteTopicRows, {
      onConflict: "prerequisite_id,topic_id",
    });

  if (prerequisiteTopicsError) {
    throw prerequisiteTopicsError;
  }

  const { error: questionsError } = await supabase.from("questions").upsert(
    seedQuestions.map((question) => ({
      id: question.id,
      course_id: question.courseId,
      topic_id: question.topicId,
      prompt: question.prompt,
      correct_option_id: question.correctOptionId,
      explanation: question.explanation,
      difficulty: question.difficulty,
      error_type: question.errorType,
      tags: question.tags,
    })),
  );

  if (questionsError) {
    throw questionsError;
  }

  const optionRows = seedQuestions.flatMap((question) =>
    question.options.map((option, index) => ({
      question_id: question.id,
      id: option.id,
      text: option.text,
      order: index + 1,
      error_type: option.misconception ?? null,
      prerequisite_id: option.prerequisiteId ?? null,
    })),
  );

  const { error: optionsError } = await supabase
    .from("question_options")
    .upsert(optionRows, { onConflict: "question_id,id" });

  if (optionsError) {
    throw optionsError;
  }

  const questionPrerequisiteRows = seedQuestions.flatMap((question) =>
    question.prerequisiteIds.map((prerequisiteId) => ({
      question_id: question.id,
      prerequisite_id: prerequisiteId,
    })),
  );

  const { error: questionPrerequisitesError } = await supabase
    .from("question_prerequisites")
    .upsert(questionPrerequisiteRows, {
      onConflict: "question_id,prerequisite_id",
    });

  if (questionPrerequisitesError) {
    throw questionPrerequisitesError;
  }

  const { error: assessmentSchedulesError } = await supabase
    .from("assessment_schedules")
    .upsert(
      officialAssessments.map((assessment) => ({
        id: assessment.id,
        title: assessment.title,
        description: assessment.description,
        course_id: assessment.courseId,
        topic_id: assessment.topicId,
        scope: assessment.scope,
        question_count: assessment.questionCount,
        difficulty_mix: assessment.difficultyMix,
        minimum_score: assessment.minimumScore,
        max_attempts: assessment.maxAttempts,
        available_at: assessment.availableAt,
        due_at: assessment.dueAt,
        deadline_policy: assessment.deadlinePolicy,
        required: assessment.required,
        active: true,
      })),
    );

  if (assessmentSchedulesError) {
    throw assessmentSchedulesError;
  }
}

async function upsertInitialUser() {
  if (!initialEmail) {
    console.log(
      "INITIAL_USER_EMAIL não informado; conteúdo semeado sem criar usuário administrativo.",
    );
    return { created: false, skipped: true };
  }

  const { data: userList, error: listError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    throw listError;
  }

  const existingUser = userList.users.find(
    (user) => user.email?.toLowerCase() === initialEmail.toLowerCase(),
  );

  const initialPassword = requestedInitialPassword ?? generatedInitialPassword;
  const userResult = existingUser
    ? await supabase.auth.admin.updateUserById(existingUser.id, {
        ...(requestedInitialPassword
          ? { password: requestedInitialPassword }
          : {}),
        email_confirm: true,
        user_metadata: { name: initialName },
      })
    : await supabase.auth.admin.createUser({
        email: initialEmail,
        password: initialPassword,
        email_confirm: true,
        user_metadata: { name: initialName },
      });

  if (userResult.error || !userResult.data.user) {
    throw userResult.error ?? new Error("Supabase did not return a user.");
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userResult.data.user.id,
    email: initialEmail,
    name: initialName,
    role: "admin",
  });

  if (profileError) {
    throw profileError;
  }

  return { created: !existingUser, skipped: false };
}

async function main() {
  await upsertAcademicContent();
  const userSeed = await upsertInitialUser();

  console.log("Seed concluído.");
  if (initialEmail) {
    console.log(`Usuário administrativo: ${initialEmail}`);
    if (requestedInitialPassword) {
      console.log("Senha definida a partir de INITIAL_USER_PASSWORD.");
    } else if (userSeed.created) {
      console.log(`Senha temporária: ${generatedInitialPassword}`);
    } else {
      console.log("Senha do usuário existente preservada.");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
