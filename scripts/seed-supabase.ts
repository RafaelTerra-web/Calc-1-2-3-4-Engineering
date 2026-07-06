import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import {
  courses,
  prerequisites,
  seedQuestions,
  topics,
} from "../src/lib/curriculum";

const initialEmail = "rafaelmodiecai@gmail.com";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

const temporaryPassword = `${randomBytes(18).toString("base64url")}A1!`;

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
}

async function upsertInitialUser() {
  const { data: userList, error: listError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    throw listError;
  }

  const existingUser = userList.users.find(
    (user) => user.email?.toLowerCase() === initialEmail.toLowerCase(),
  );

  const userResult = existingUser
    ? await supabase.auth.admin.updateUserById(existingUser.id, {
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { name: "Rafael Terra" },
      })
    : await supabase.auth.admin.createUser({
        email: initialEmail,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { name: "Rafael Terra" },
      });

  if (userResult.error || !userResult.data.user) {
    throw userResult.error ?? new Error("Supabase did not return a user.");
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userResult.data.user.id,
    email: initialEmail,
    name: "Rafael Terra",
  });

  if (profileError) {
    throw profileError;
  }
}

async function main() {
  await upsertAcademicContent();
  await upsertInitialUser();

  console.log("Seed concluido.");
  console.log(`Usuario: ${initialEmail}`);
  console.log(`Senha temporaria: ${temporaryPassword}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
