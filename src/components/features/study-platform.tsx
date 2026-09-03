"use client";

import Image from "next/image";
import {
  ArrowRight,
  Bell,
  Brain,
  CalendarDays,
  Calculator,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Database,
  ExternalLink,
  Film,
  GraduationCap,
  Home,
  LineChart,
  ListChecks,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Palette,
  Play,
  RotateCcw,
  SearchCheck,
  Settings,
  Sparkles,
  Sun,
  Target,
  Timer,
  Trophy,
  Upload,
  Video,
  XCircle,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { buildDiagnostics, getQuestionProgress } from "@/lib/analytics";
import {
  buildAssessmentNotifications,
  buildOfficialExamStats,
  createDefaultAssessments,
  DEFAULT_DIFFICULTY_TIME_MINUTES,
  describeAssessmentScope,
  formatAssessmentDueDate,
  formatAssessmentWindow,
  getAssessmentStatusLabel,
} from "@/lib/assessments";
import {
  courses,
  getCourse,
  getPrerequisite,
  getTopic,
  getTopicsByCourse,
  prerequisites,
  seedQuestions,
} from "@/lib/curriculum";
import { parseQuestionImport } from "@/lib/importer";
import { createClient } from "@/lib/supabase/client";
import {
  getVideosForQuestion,
  internalPlaylistUrls,
  videoResources,
} from "@/lib/videos";
import type {
  AssessmentNotification,
  Attempt,
  CourseId,
  Diagnostics,
  ExamAttempt,
  ExamAttemptStatus,
  OfficialAssessment,
  OfficialExamStats,
  PracticeSessionAnswer,
  PracticeSessionSummary,
  Question,
  QuestionVideos,
  Recommendation,
  StudyUser,
  VideoResource,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/features/brand-logo";
import {
  OfficialExamRunner,
  type OfficialExamQuestion,
  type OfficialExamSession,
} from "@/components/features/official-exam-runner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type ViewId =
  | "dashboard"
  | "trilhas"
  | "pre-requisitos"
  | "pratica"
  | "provas"
  | "playlists"
  | "importacao"
  | "admin";

type Feedback = {
  correct: boolean;
  correctOptionText: string;
  explanation: string;
};

type ImportedQuestionRow = {
  id: string;
  question: Question;
};

type OfficialExamAnswerRow = {
  id: string;
  attempt_id: string;
  question_id: string;
  course_id: CourseId;
  topic_id: string;
  prerequisite_ids: string[] | null;
  selected_option_id: string | null;
  correct_option_id: string;
  correct: boolean;
  time_spent_seconds: number;
  difficulty: "basico" | "medio" | "avancado";
  error_type: string;
  answered_at: string;
};

type PracticeAttemptRow = {
  id: string;
  question_id: string;
  course_id: CourseId;
  topic_id: string;
  prerequisite_ids: string[] | null;
  selected_option_id: string;
  correct_option_id: string;
  correct: boolean;
  time_spent_seconds: number;
  difficulty: Question["difficulty"];
  error_type: string;
  created_at: string;
};

type OfficialExamAttemptRow = {
  id: string;
  assessment_id: string;
  course_id: CourseId;
  topic_id: string;
  status: ExamAttemptStatus;
  score: number;
  correct_count: number;
  question_count: number;
  question_ids: string[] | null;
  time_limit_seconds: number;
  time_spent_seconds: number;
  started_at: string;
  submitted_at: string | null;
  created_at: string;
};

type AssessmentScheduleRow = {
  id: string;
  title: string;
  description: string;
  course_id: CourseId;
  topic_id: string;
  scope: OfficialAssessment["scope"];
  question_count: number;
  difficulty_mix: OfficialAssessment["difficultyMix"];
  minimum_score: number;
  max_attempts: number;
  available_at: string;
  due_at: string;
  deadline_policy: OfficialAssessment["deadlinePolicy"];
  required: boolean;
};

type StartOfficialExamResponse = {
  attempt: ExamAttempt;
  questions: OfficialExamQuestion[];
};

type SubmittedOfficialAnswer = {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string;
  correct: boolean;
  timeSpentSeconds?: number;
  explanation: string;
  errorType: string;
  prerequisiteIds: string[];
};

type SubmitOfficialExamResponse = {
  attempt: ExamAttempt;
  answers: SubmittedOfficialAnswer[];
  score: number;
  correctCount: number;
};

type ThemeMode = "light" | "dark";

const REMEMBERED_PROFILE_KEY = "calculo-em-foco:remembered-profile";
const THEME_STORAGE_KEY = "calculo-em-foco:theme";
const EXAM_DRAFT_KEY_PREFIX = "calculo-em-foco:official-exam-draft:";
const LEGACY_STORAGE_KEYS = [
  "calculo-em-foco:user",
  "calculo-em-foco:attempts",
  "calculo-em-foco:imported-questions",
];

const navItems: Array<{ id: ViewId; label: string; iconSrc: string }> = [
  { id: "dashboard", label: "Hoje", iconSrc: "/icons/nav-dashboard.svg" },
  { id: "trilhas", label: "Trilhas", iconSrc: "/icons/nav-trilhas.svg" },
  {
    id: "pre-requisitos",
    label: "Pré-requisitos",
    iconSrc: "/icons/nav-pre-requisitos.svg",
  },
  { id: "pratica", label: "Prática", iconSrc: "/icons/nav-pratica.svg" },
  { id: "provas", label: "Provas", iconSrc: "/icons/nav-provas.svg" },
  { id: "playlists", label: "Playlists", iconSrc: "/icons/nav-playlists.svg" },
  {
    id: "importacao",
    label: "Importação",
    iconSrc: "/icons/nav-importacao.svg",
  },
  { id: "admin", label: "Admin", iconSrc: "/icons/nav-admin.svg" },
];

const importExample = `courseId,topicId,prerequisiteIds,prompt,optionA,optionB,optionC,optionD,correctOptionId,explanation,difficulty,errorType,tags
calculo-1,limites,pre-fatoracao|pre-produtos-notaveis,"Calcule lim_{x -> 1} (x^2 - 1)/(x - 1).",0,1,2,"Não existe",c,"Fatore x^2 - 1 = (x - 1)(x + 1) e substitua x = 1.",basico,"Fatoração em limite","limites|fatoracao"`;

export function StudyPlatform({
  initialRoute,
  initialUser,
  supabaseConfigured,
}: {
  initialRoute?: { view?: string; course?: string; topic?: string };
  initialUser: StudyUser | null;
  supabaseConfigured: boolean;
}) {
  const initialRouteState = resolveInitialRoute(initialRoute);
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<StudyUser | null>(initialUser);
  const [officialAnswerAttempts, setOfficialAnswerAttempts] = useState<
    Attempt[]
  >([]);
  const [practiceAttempts, setPracticeAttempts] = useState<Attempt[]>([]);
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([]);
  const [assessments, setAssessments] = useState<OfficialAssessment[]>(() =>
    createDefaultAssessments(new Date()),
  );
  const [practiceSessionAnswers, setPracticeSessionAnswers] = useState<
    PracticeSessionAnswer[]
  >([]);
  const [activeExamSession, setActiveExamSession] =
    useState<OfficialExamSession | null>(null);
  const [importedQuestions, setImportedQuestions] = useState<Question[]>([]);
  const [activeView, setActiveView] = useState<ViewId>(initialRouteState.view);
  const [selectedCourseId, setSelectedCourseId] = useState<CourseId>(
    initialRouteState.courseId,
  );
  const [selectedTopicId, setSelectedTopicId] = useState(
    initialRouteState.topicId,
  );
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [loadingData, setLoadingData] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [startingAssessmentId, setStartingAssessmentId] = useState<
    string | null
  >(null);
  const [submittingExam, setSubmittingExam] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [referenceDate, setReferenceDate] = useState(() =>
    new Date().toISOString(),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      const nextTheme: ThemeMode = storedTheme === "dark" ? "dark" : "light";

      applyTheme(nextTheme);
      setTheme(nextTheme);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(
      () => setReferenceDate(new Date().toISOString()),
      60_000,
    );

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", activeView);
    url.searchParams.set("course", selectedCourseId);
    url.searchParams.set("topic", selectedTopicId);
    window.history.replaceState(window.history.state, "", url);
  }, [activeView, selectedCourseId, selectedTopicId]);

  useEffect(() => {
    if (!user || !supabase) {
      return;
    }

    let cancelled = false;

    async function loadUserData() {
      setLoadingData(true);
      const [
        officialAnswerResult,
        practiceAttemptResult,
        officialAttemptResult,
        assessmentScheduleResult,
        importResult,
      ] = await Promise.all([
        supabase
          .from("official_exam_answers")
          .select(
            "id, attempt_id, question_id, course_id, topic_id, prerequisite_ids, selected_option_id, correct_option_id, correct, time_spent_seconds, difficulty, error_type, answered_at",
          )
          .order("answered_at", { ascending: false }),
        supabase
          .from("attempts")
          .select(
            "id, question_id, course_id, topic_id, prerequisite_ids, selected_option_id, correct_option_id, correct, time_spent_seconds, difficulty, error_type, created_at",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("official_exam_attempts")
          .select(
            "id, assessment_id, course_id, topic_id, status, score, correct_count, question_count, question_ids, time_limit_seconds, time_spent_seconds, started_at, submitted_at, created_at",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("assessment_schedules")
          .select(
            "id, title, description, course_id, topic_id, scope, question_count, difficulty_mix, minimum_score, max_attempts, available_at, due_at, deadline_policy, required",
          )
          .eq("active", true)
          .order("due_at", { ascending: true }),
        supabase
          .from("imported_questions")
          .select("id, question")
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) {
        return;
      }

      const loadedPracticeAttempts = (
        (practiceAttemptResult.data ?? []) as PracticeAttemptRow[]
      ).map(practiceAttemptRowToAttempt);
      const loadedExamAttempts = (
        (officialAttemptResult.data ?? []) as OfficialExamAttemptRow[]
      ).map(rowToExamAttempt);
      const statusByAttemptId = new Map(
        loadedExamAttempts.map((attempt) => [attempt.id, attempt.status]),
      );
      const loadedOfficialAnswers = (
        (officialAnswerResult.data ?? []) as OfficialExamAnswerRow[]
      ).map((row) => ({
        ...officialAnswerRowToAttempt(row),
        assessmentStatus: statusByAttemptId.get(row.attempt_id),
      }));
      const loadedAssessments = (
        (assessmentScheduleResult.data ?? []) as AssessmentScheduleRow[]
      ).map(rowToAssessment);
      const dataErrors = [
        officialAnswerResult.error && "respostas oficiais",
        practiceAttemptResult.error && "histórico de prática",
        officialAttemptResult.error && "tentativas oficiais",
        assessmentScheduleResult.error && "agenda de provas",
        importResult.error && "questões importadas",
      ].filter(Boolean) as string[];

      setOfficialAnswerAttempts(loadedOfficialAnswers);
      setPracticeAttempts(loadedPracticeAttempts);
      setExamAttempts(loadedExamAttempts);
      setAssessments(
        loadedAssessments.length
          ? loadedAssessments
          : createDefaultAssessments(new Date()),
      );
      setImportedQuestions(
        ((importResult.data ?? []) as ImportedQuestionRow[]).map(
          (row) => row.question,
        ),
      );

      const unfinishedAttempt = loadedExamAttempts.find(
        (attempt) => attempt.status === "in_progress",
      );
      const unfinishedAssessment = unfinishedAttempt
        ? (loadedAssessments.length
            ? loadedAssessments
            : createDefaultAssessments(new Date())
          ).find(
            (assessment) => assessment.id === unfinishedAttempt.assessmentId,
          )
        : null;

      if (unfinishedAssessment) {
        const { data, error } = await supabase.rpc("start_official_exam", {
          p_assessment_id: unfinishedAssessment.id,
        });

        if (cancelled) {
          return;
        }

        const response = parseStartOfficialExamResponse(data);
        if (error || !response) {
          dataErrors.push("retomada da prova em andamento");
        } else {
          setExamAttempts((current) =>
            upsertExamAttempt(current, response.attempt),
          );
          setActiveExamSession(
            responseToExamSession(response, unfinishedAssessment),
          );
          setActiveView("provas");
        }
      }

      setStatusMessage(
        dataErrors.length
          ? `Alguns dados não puderam ser carregados: ${dataErrors.join(", ")}. Tente atualizar a página.`
          : null,
      );

      setLoadingData(false);
    }

    void loadUserData();

    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const allQuestions = useMemo(
    () => [...seedQuestions, ...importedQuestions],
    [importedQuestions],
  );

  const diagnosticAttempts = useMemo(
    () => [...officialAnswerAttempts, ...practiceAttempts],
    [officialAnswerAttempts, practiceAttempts],
  );
  const practiceSummaries = useMemo<PracticeSessionSummary[]>(
    () =>
      practiceAttempts.slice(0, 12).map((attempt) => ({
        id: `practice-summary-${attempt.id}`,
        courseId: attempt.courseId,
        topicId: attempt.topicId,
        total: 1,
        correct: attempt.correct ? 1 : 0,
        completedAt: attempt.createdAt,
      })),
    [practiceAttempts],
  );

  const diagnostics = useMemo(
    () => buildDiagnostics(allQuestions, diagnosticAttempts),
    [allQuestions, diagnosticAttempts],
  );

  const examStats = useMemo(
    () => buildOfficialExamStats(assessments, examAttempts, referenceDate),
    [assessments, examAttempts, referenceDate],
  );
  const assessmentNotifications = useMemo(
    () =>
      buildAssessmentNotifications(assessments, examAttempts, referenceDate),
    [assessments, examAttempts, referenceDate],
  );

  const filteredQuestions = useMemo(
    () =>
      allQuestions.filter(
        (question) =>
          question.courseId === selectedCourseId &&
          question.topicId === selectedTopicId,
      ),
    [allQuestions, selectedCourseId, selectedTopicId],
  );

  const activeQuestion = useMemo(() => {
    if (activeQuestionId) {
      return (
        filteredQuestions.find(
          (question) => question.id === activeQuestionId,
        ) ??
        filteredQuestions[0] ??
        null
      );
    }

    return filteredQuestions[0] ?? null;
  }, [activeQuestionId, filteredQuestions]);

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";

    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
  }

  function startPractice(courseId: CourseId, topicId: string) {
    setSelectedCourseId(courseId);
    setSelectedTopicId(topicId);
    setActiveView("pratica");
    resetQuestionState();
  }

  function resetQuestionState() {
    setActiveQuestionId(null);
    setSelectedOptionId(null);
    setFeedback(null);
    setQuestionStartedAt(Date.now());
  }

  async function signOut() {
    if (!supabase || signingOut) {
      return;
    }

    setSigningOut(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      setStatusMessage(
        `Não foi possível sair com segurança: ${error.message}. Tente novamente.`,
      );
      setSigningOut(false);
      return;
    }

    setUser(null);
    setOfficialAnswerAttempts([]);
    setPracticeAttempts([]);
    setExamAttempts([]);
    setPracticeSessionAnswers([]);
    setActiveExamSession(null);
    setImportedQuestions([]);
    setActiveView("dashboard");
    setStatusMessage(null);
    setSigningOut(false);
  }

  async function answerQuestion() {
    if (
      !activeQuestion ||
      !selectedOptionId ||
      feedback ||
      !user ||
      !supabase
    ) {
      return;
    }

    const selectedOption = activeQuestion.options.find(
      (option) => option.id === selectedOptionId,
    );
    const correctOption = activeQuestion.options.find(
      (option) => option.id === activeQuestion.correctOptionId,
    );

    if (!selectedOption || !correctOption) {
      return;
    }

    const correct = selectedOptionId === activeQuestion.correctOptionId;
    const diagnosticPrerequisiteIds = correct
      ? activeQuestion.prerequisiteIds
      : selectedOption.prerequisiteId
        ? [selectedOption.prerequisiteId]
        : [];
    const diagnosticErrorType = correct
      ? "acerto"
      : (selectedOption.misconception ?? activeQuestion.errorType);

    const { data, error } = await supabase
      .from("attempts")
      .insert({
        user_id: user.id,
        question_id: activeQuestion.id,
        course_id: activeQuestion.courseId,
        topic_id: activeQuestion.topicId,
        prerequisite_ids: diagnosticPrerequisiteIds,
        selected_option_id: selectedOptionId,
        correct_option_id: activeQuestion.correctOptionId,
        correct,
        time_spent_seconds: Math.max(
          1,
          Math.round((Date.now() - questionStartedAt) / 1000),
        ),
        difficulty: activeQuestion.difficulty,
        error_type: diagnosticErrorType,
      })
      .select(
        "id, question_id, course_id, topic_id, prerequisite_ids, selected_option_id, correct_option_id, correct, time_spent_seconds, difficulty, error_type, created_at",
      )
      .single();

    if (error || !data) {
      setStatusMessage(
        `Não foi possível salvar esta resposta de prática: ${error?.message ?? "erro desconhecido"}. Tente novamente.`,
      );
      return;
    }

    const attempt = practiceAttemptRowToAttempt(data as PracticeAttemptRow);
    setPracticeAttempts((current) => [attempt, ...current]);

    setPracticeSessionAnswers((current) => [
      ...current.filter((answer) => answer.questionId !== activeQuestion.id),
      {
        questionId: activeQuestion.id,
        courseId: activeQuestion.courseId,
        topicId: activeQuestion.topicId,
        selectedOptionId,
        correctOptionId: activeQuestion.correctOptionId,
        correct: attempt.correct,
        errorType: diagnosticErrorType,
      },
    ]);
    setFeedback({
      correct: attempt.correct,
      correctOptionText: correctOption.text,
      explanation: activeQuestion.explanation,
    });
    setStatusMessage(
      "Resposta de prática salva. Ela melhora o diagnóstico formativo, sem alterar sua nota oficial.",
    );
  }

  function finishPracticeSession() {
    const topicAnswers = practiceSessionAnswers.filter(
      (answer) =>
        answer.courseId === selectedCourseId &&
        answer.topicId === selectedTopicId,
    );

    if (topicAnswers.length === 0) {
      setStatusMessage(
        "Responda pelo menos uma questão antes de finalizar o treino.",
      );
      return;
    }

    setPracticeSessionAnswers((current) =>
      current.filter(
        (answer) =>
          answer.courseId !== selectedCourseId ||
          answer.topicId !== selectedTopicId,
      ),
    );
    resetQuestionState();
    setStatusMessage(
      "Treino finalizado. As respostas já estão no diagnóstico formativo; sua nota oficial não mudou.",
    );
  }

  async function startExam(assessment: OfficialAssessment) {
    if (!user || !supabase || startingAssessmentId) {
      setStatusMessage("Faça login com Supabase antes de iniciar uma prova.");
      return;
    }
    setStartingAssessmentId(assessment.id);
    const { data, error } = await supabase.rpc("start_official_exam", {
      p_assessment_id: assessment.id,
    });
    const response = parseStartOfficialExamResponse(data);
    setStartingAssessmentId(null);

    if (error || !response) {
      setStatusMessage(
        `Não consegui iniciar a prova: ${error?.message ?? "resposta inválida do servidor"}`,
      );
      return;
    }

    setExamAttempts((current) => upsertExamAttempt(current, response.attempt));
    setActiveExamSession(responseToExamSession(response, assessment));
    setActiveView("provas");
    setStatusMessage(
      response.attempt.status === "in_progress"
        ? "Prova pronta. O relógio usa o horário registrado no servidor."
        : null,
    );
  }

  function selectExamAnswer(questionId: string, optionId: string) {
    setActiveExamSession((current) => {
      if (!current) return current;
      const next = {
        ...current,
        selectedAnswers: { ...current.selectedAnswers, [questionId]: optionId },
      };
      saveExamDraft(next);
      return next;
    });
  }

  function recordExamQuestionTime(questionId: string, seconds: number) {
    if (seconds <= 0) return;
    setActiveExamSession((current) => {
      if (!current) return current;
      const next = {
        ...current,
        timeSpentByQuestion: {
          ...current.timeSpentByQuestion,
          [questionId]:
            (current.timeSpentByQuestion[questionId] ?? 0) + seconds,
        },
      };
      saveExamDraft(next);
      return next;
    });
  }

  async function submitExam(finalTiming?: {
    questionId: string;
    seconds: number;
  }) {
    if (!activeExamSession || !user || !supabase || submittingExam) {
      return false;
    }

    const session: OfficialExamSession = finalTiming
      ? {
          ...activeExamSession,
          timeSpentByQuestion: {
            ...activeExamSession.timeSpentByQuestion,
            [finalTiming.questionId]:
              (activeExamSession.timeSpentByQuestion[finalTiming.questionId] ??
                0) + finalTiming.seconds,
          },
        }
      : activeExamSession;
    const expired =
      Date.now() >= session.startedAt + session.timeLimitSeconds * 1000;
    const unanswered = session.questions.filter(
      (question) => !session.selectedAnswers[question.id],
    );

    if (unanswered.length > 0 && !expired) {
      setStatusMessage("Responda todas as questões antes de entregar a prova.");
      return false;
    }

    const p_answers = Object.fromEntries(
      session.questions.map((question) => [
        question.id,
        {
          optionId: session.selectedAnswers[question.id] ?? null,
          timeSpentSeconds: Math.max(
            0,
            Math.round(session.timeSpentByQuestion[question.id] ?? 0),
          ),
        },
      ]),
    );

    setSubmittingExam(true);
    const { data, error } = await supabase.rpc("submit_official_exam", {
      p_attempt_id: session.attemptId,
      p_answers,
    });
    const response = parseSubmitOfficialExamResponse(data);
    setSubmittingExam(false);

    if (error || !response) {
      saveExamDraft(session);
      setStatusMessage(
        `Não consegui entregar a prova: ${error?.message ?? "resposta inválida do servidor"}. Suas marcações continuam salvas neste navegador.`,
      );
      return false;
    }

    setExamAttempts((current) => upsertExamAttempt(current, response.attempt));
    setOfficialAnswerAttempts((current) => [
      ...response.answers.map(
        (answer, index): Attempt => ({
          id: `${response.attempt.id}:${answer.questionId}`,
          questionId: answer.questionId,
          courseId: response.attempt.courseId,
          topicId: response.attempt.topicId,
          prerequisiteIds: answer.prerequisiteIds,
          selectedOptionId: answer.selectedOptionId ?? "__sem_resposta__",
          correctOptionId: answer.correctOptionId,
          correct: answer.correct,
          timeSpentSeconds: answer.timeSpentSeconds ?? 0,
          difficulty: session.questions[index]?.difficulty ?? "medio",
          errorType: answer.errorType,
          createdAt: response.attempt.submittedAt ?? new Date().toISOString(),
          source: "official_exam",
          assessmentStatus: response.attempt.status,
        }),
      ),
      ...current.filter(
        (attempt) => !attempt.id.startsWith(`${response.attempt.id}:`),
      ),
    ]);
    clearExamDraft(session.attemptId);
    setActiveExamSession(null);
    setStatusMessage(
      response.attempt.status === "expired"
        ? "Tempo esgotado. A tentativa foi registrada como expirada e não entra no domínio pedagógico."
        : `Prova corrigida no servidor: ${response.score}% (${response.correctCount}/${response.attempt.questionCount}).`,
    );
    return true;
  }

  function moveToNextQuestion() {
    if (!activeQuestion || filteredQuestions.length === 0) {
      return;
    }

    const currentIndex = filteredQuestions.findIndex(
      (question) => question.id === activeQuestion.id,
    );
    const nextQuestion =
      filteredQuestions[(currentIndex + 1) % filteredQuestions.length];

    setActiveQuestionId(nextQuestion.id);
    setSelectedOptionId(null);
    setFeedback(null);
    setQuestionStartedAt(Date.now());
  }

  async function importQuestions(questions: Question[]) {
    if (!user || !supabase) {
      setStatusMessage("Faça login com Supabase antes de importar questões.");
      return false;
    }

    const rows = questions.map((question) => ({
      id: question.id,
      user_id: user.id,
      question,
    }));

    const { error } = await supabase
      .from("imported_questions")
      .upsert(rows, { onConflict: "id,user_id" });

    if (error) {
      setStatusMessage(`Não consegui importar: ${error.message}`);
      return false;
    }

    setImportedQuestions((current) => dedupeQuestions(current, questions));
    setStatusMessage(
      `${questions.length} ${questions.length === 1 ? "questão importada" : "questões importadas"}.`,
    );
    return true;
  }

  async function resetImportedQuestions() {
    if (!user || !supabase) {
      return;
    }
    if (
      !window.confirm(
        `Remover permanentemente ${importedQuestions.length} questão(ões) importada(s) da sua conta?`,
      )
    ) {
      return;
    }

    const { error } = await supabase
      .from("imported_questions")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      setStatusMessage(`Não consegui limpar importadas: ${error.message}`);
      return;
    }

    setImportedQuestions([]);
    setStatusMessage("Questões importadas removidas.");
  }

  async function saveAssessmentSchedule(assessment: OfficialAssessment) {
    if (!user || !supabase) {
      setStatusMessage("Faça login antes de alterar configurações.");
      return false;
    }

    if (user.role !== "admin") {
      setStatusMessage("Apenas admin pode alterar agenda e regras de prova.");
      return false;
    }

    const { error } = await supabase.from("assessment_schedules").upsert({
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
      time_settings: DEFAULT_DIFFICULTY_TIME_MINUTES,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setStatusMessage(`Não consegui salvar a configuração: ${error.message}`);
      return false;
    }

    setAssessments((current) =>
      current.map((item) => (item.id === assessment.id ? assessment : item)),
    );
    setStatusMessage("Configuração de prova atualizada.");
    return true;
  }

  if (!supabaseConfigured || !supabase) {
    return <SetupRequiredScreen />;
  }

  if (!user) {
    return (
      <SignInScreen
        supabaseConfigured={supabaseConfigured}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRequestPasswordReset={async (email) => {
          const redirectTo = `${window.location.origin}/auth/callback?next=/redefinir-senha`;
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo,
          });

          return error
            ? { ok: false as const, message: error.message }
            : { ok: true as const };
        }}
        onSignIn={async ({ email, password, remember }) => {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error || !data.user) {
            return {
              ok: false,
              message:
                error?.message ??
                "Não foi possível autenticar com as credenciais informadas.",
            };
          }

          const nextUser = authUserToStudyUser(data.user);

          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .upsert({
              id: nextUser.id,
              email: nextUser.email,
              name: nextUser.name,
            })
            .select("name, email, role, created_at")
            .single();

          if (profileError || !profile) {
            await supabase.auth.signOut();
            return {
              ok: false,
              message: `Login aceito, mas o perfil não pôde ser carregado: ${profileError?.message ?? "perfil ausente"}.`,
            };
          }

          const userWithProfile: StudyUser = {
            ...nextUser,
            name: profile?.name ?? nextUser.name,
            email: profile?.email ?? nextUser.email,
            role: profile?.role === "admin" ? "admin" : "student",
            createdAt: profile?.created_at ?? nextUser.createdAt,
          };

          rememberProfile(remember ? userWithProfile : null);
          setUser(userWithProfile);
          setActiveView("dashboard");
          setStatusMessage(null);

          return { ok: true };
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-border bg-card/40 lg:block">
          <Sidebar
            activeView={activeView}
            assessmentNotifications={assessmentNotifications}
            diagnostics={diagnostics}
            examStats={examStats}
            theme={theme}
            user={user}
            onLogout={signOut}
            onNavigate={setActiveView}
            onToggleTheme={toggleTheme}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <TopBar
            activeView={activeView}
            assessmentNotifications={assessmentNotifications}
            diagnostics={diagnostics}
            examStats={examStats}
            theme={theme}
            user={user}
            onLogout={signOut}
            onNavigate={setActiveView}
            onToggleTheme={toggleTheme}
          />

          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
            {(loadingData || statusMessage) && (
              <Alert className="rounded-md">
                {loadingData ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <CircleAlert className="h-4 w-4" aria-hidden="true" />
                )}
                <AlertTitle>
                  {loadingData ? "Carregando dados" : "Status"}
                </AlertTitle>
                <AlertDescription>
                  {loadingData ? "Sincronizando com Supabase." : statusMessage}
                </AlertDescription>
              </Alert>
            )}

            {activeView === "dashboard" && (
              <DashboardView
                attempts={diagnosticAttempts}
                assessments={assessments}
                assessmentNotifications={assessmentNotifications}
                diagnostics={diagnostics}
                examStats={examStats}
                onNavigate={setActiveView}
                onStartExam={startExam}
                onStartPractice={startPractice}
                practiceSummaries={practiceSummaries}
                referenceDate={referenceDate}
              />
            )}

            {activeView === "trilhas" && (
              <TrailsView
                attempts={diagnosticAttempts}
                diagnostics={diagnostics}
                onStartPractice={startPractice}
                questions={allQuestions}
              />
            )}

            {activeView === "pre-requisitos" && (
              <PrerequisitesView
                diagnostics={diagnostics}
                onStartPractice={startPractice}
              />
            )}

            {activeView === "pratica" && (
              <PracticeView
                activeQuestion={activeQuestion}
                feedback={feedback}
                filteredQuestions={filteredQuestions}
                onAnswerQuestion={answerQuestion}
                onFinishPractice={finishPracticeSession}
                onMoveToNextQuestion={moveToNextQuestion}
                onSelectCourse={(courseId) => {
                  const firstTopic = getTopicsByCourse(courseId)[0]?.id ?? "";
                  setSelectedCourseId(courseId);
                  setSelectedTopicId(firstTopic);
                  resetQuestionState();
                }}
                onSelectOption={setSelectedOptionId}
                onSelectQuestion={(questionId) => {
                  setActiveQuestionId(questionId);
                  setSelectedOptionId(null);
                  setFeedback(null);
                  setQuestionStartedAt(Date.now());
                }}
                onSelectTopic={(topicId) => {
                  setSelectedTopicId(topicId);
                  resetQuestionState();
                }}
                selectedCourseId={selectedCourseId}
                selectedOptionId={selectedOptionId}
                selectedTopicId={selectedTopicId}
                sessionAnswers={practiceSessionAnswers}
              />
            )}

            {activeView === "provas" && (
              <ExamsView
                activeSession={activeExamSession}
                assessments={assessments}
                attempts={examAttempts}
                notifications={assessmentNotifications}
                onCancelSession={() => setActiveExamSession(null)}
                onRecordQuestionTime={recordExamQuestionTime}
                onSelectAnswer={selectExamAnswer}
                onStartExam={startExam}
                onSubmitExam={submitExam}
                pending={submittingExam}
                referenceDate={referenceDate}
              />
            )}

            {activeView === "playlists" && (
              <PlaylistsView questions={allQuestions} />
            )}

            {activeView === "importacao" && (
              <ImportView
                importedQuestions={importedQuestions}
                onImport={importQuestions}
                onResetImported={resetImportedQuestions}
              />
            )}

            {activeView === "admin" && (
              <AdminView
                assessments={assessments}
                onSaveAssessment={saveAssessmentSchedule}
                user={user}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function SetupRequiredScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-2xl rounded-md">
        <CardHeader>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Settings className="h-5 w-5" aria-hidden="true" />
          </div>
          <CardTitle>Supabase ainda não está configurado</CardTitle>
          <CardDescription>
            Configure o recurso pelo Vercel Marketplace e puxe as variáveis
            antes de usar o login real.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="rounded-md">
            <Database className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Variáveis obrigatórias</AlertTitle>
            <AlertDescription className="min-w-0">
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>
                  <code className="break-all">NEXT_PUBLIC_SUPABASE_URL</code>
                </li>
                <li>
                  <code className="break-all">
                    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
                  </code>
                </li>
                <li>
                  <code className="break-all">SUPABASE_SERVICE_ROLE_KEY</code>
                </li>
                <li>
                  <code className="break-all">DATABASE_URL</code> ou{" "}
                  <code className="break-all">POSTGRES_URL_NON_POOLING</code>
                </li>
              </ul>
            </AlertDescription>
          </Alert>
          <p className="text-sm leading-6 text-muted-foreground">
            Depois de provisionar, rode{" "}
            <code className="break-all">
              npx vercel env pull .env.local --yes
            </code>{" "}
            ou preencha <code>.env.local</code> manualmente. A tela de login
            aparecerá sem precisar alterar código.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function SignInScreen({
  onSignIn,
  onRequestPasswordReset,
  supabaseConfigured,
  theme,
  onToggleTheme,
}: {
  onSignIn: (input: {
    email: string;
    password: string;
    remember: boolean;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
  onRequestPasswordReset: (
    email: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  supabaseConfigured: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const remembered = readRememberedProfile();

      if (remembered?.email) {
        setEmail(remembered.email);
      }

      if (
        new URL(window.location.href).searchParams.get("senha") === "atualizada"
      ) {
        setSuccess({
          title: "Senha atualizada",
          message: "Tudo certo. Entre com a sua nova senha.",
        });
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const result = await onSignIn({
      email: email.trim(),
      password,
      remember,
    });

    if (!result.ok) {
      setError(result.message);
    }

    setPending(false);
  }

  async function handlePasswordReset() {
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Informe um e-mail válido para receber o link de recuperação.");
      setSuccess(null);
      return;
    }

    setResetPending(true);
    setError(null);
    setSuccess(null);

    const result = await onRequestPasswordReset(normalizedEmail);

    if (result.ok) {
      setSuccess({
        title: "Confira seu e-mail",
        message:
          "Se existir uma conta com esse endereço, enviaremos um link de recuperação. Confira também a caixa de spam.",
      });
    } else {
      setError(
        result.message ||
          "Não foi possível enviar o e-mail de recuperação agora.",
      );
    }

    setResetPending(false);
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#10353d] text-[#f2ead9]">
      <Image
        alt=""
        aria-hidden="true"
        className="object-cover object-[34%_center] lg:object-center"
        fill
        priority
        sizes="100vw"
        src="/visuals/login-engineering-art-1080p.png"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,30,35,0.74)_0%,rgba(7,30,35,0.3)_52%,rgba(7,30,35,0.08)_100%),linear-gradient(0deg,rgba(5,22,27,0.54)_0%,transparent_48%)]" />

      <div className="relative z-10 grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(36rem,0.92fr)] xl:grid-cols-[minmax(0,1.06fr)_minmax(40rem,0.94fr)]">
        <section className="flex min-h-[34rem] flex-col justify-between px-6 py-7 sm:px-10 sm:py-9 lg:min-h-dvh lg:px-14 lg:py-12 xl:px-16">
          <div className="flex items-center justify-between gap-4">
            <BrandLogo className="text-[#f2ead9] [&_p:first-child]:text-[#c6d5d1]" />
            <ThemeToggleButtonOnArtwork
              theme={theme}
              onToggleTheme={onToggleTheme}
            />
          </div>

          <div className="max-w-xl py-12 lg:py-16">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-[#e6934c]">
              Fundamentos · Aplicação · Domínio
            </p>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.65rem]">
              Compreenda a base. Avance com clareza.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#d4ddd9] sm:text-lg">
              Diagnóstico inteligente, revisão dos fundamentos e prática guiada
              para transformar dificuldade em domínio.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[#f2ead9]/25 pt-4 text-xs uppercase tracking-[0.14em] text-[#d4ddd9]">
            <span>Diagnóstico</span>
            <span>Pré-requisitos</span>
            <span>Prática</span>
            <span>Progresso</span>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8 sm:py-12 lg:min-h-dvh lg:px-10 xl:px-14">
          <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/[0.16] bg-[linear-gradient(145deg,rgba(8,30,36,0.82),rgba(4,18,24,0.62))] p-7 text-[#f5f1e8] shadow-[0_36px_120px_-32px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.16)] ring-1 ring-inset ring-white/[0.04] backdrop-blur-[30px] backdrop-saturate-150 sm:p-10 lg:p-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-white/[0.08] blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-[#4e9da3]/[0.12] blur-3xl"
            />
            <div className="relative z-10">
              <div className="mb-9 flex items-end justify-between gap-4 border-b border-white/[0.14] pb-6">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-[#e99a58]">
                    Área do aluno
                  </p>
                  <h2 className="text-4xl font-semibold tracking-tight">
                    Entrar
                  </h2>
                </div>
                <span className="font-mono text-sm text-white/45">01</span>
              </div>

              <div>
                <p className="mb-8 max-w-md text-sm leading-6 text-white/65">
                  Entre com seus dados para retomar o plano de estudos e
                  acompanhar seu progresso.
                </p>
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="space-y-2.5">
                    <Label
                      className="text-sm font-medium text-white/85"
                      htmlFor="email"
                    >
                      E-mail
                    </Label>
                    <Input
                      autoComplete="email"
                      className="h-12 rounded-xl border-white/[0.14] bg-white/[0.065] px-4 text-[#f8f4ec] shadow-inner placeholder:text-white/35 focus-visible:border-[#e99a58]/80 focus-visible:ring-[#e99a58]/25"
                      disabled={!supabaseConfigured || pending || resetPending}
                      id="email"
                      placeholder="seuemail@exemplo.com"
                      required
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2.5">
                    <Label
                      className="text-sm font-medium text-white/85"
                      htmlFor="password"
                    >
                      Senha
                    </Label>
                    <Input
                      autoComplete="current-password"
                      className="h-12 rounded-xl border-white/[0.14] bg-white/[0.065] px-4 text-[#f8f4ec] shadow-inner placeholder:text-white/35 focus-visible:border-[#e99a58]/80 focus-visible:ring-[#e99a58]/25"
                      disabled={!supabaseConfigured || pending || resetPending}
                      id="password"
                      placeholder="Sua senha"
                      required
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-white/60">
                      <input
                        checked={remember}
                        className="h-4 w-4 accent-[#e99a58]"
                        disabled={pending || resetPending}
                        onChange={(event) => setRemember(event.target.checked)}
                        type="checkbox"
                      />
                      <span>Manter conectado</span>
                    </label>
                    <Button
                      className="h-auto p-0 text-sm text-[#f0a262] hover:text-[#ffc28c]"
                      disabled={!supabaseConfigured || pending || resetPending}
                      onClick={handlePasswordReset}
                      type="button"
                      variant="link"
                    >
                      {resetPending ? "Enviando..." : "Esqueci minha senha"}
                    </Button>
                  </div>

                  {error && (
                    <Alert
                      className="rounded-2xl border-rose-400/30 bg-rose-950/30 text-rose-100"
                      variant="destructive"
                    >
                      <CircleAlert className="h-4 w-4" aria-hidden="true" />
                      <AlertTitle>Não foi possível entrar</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  {success && (
                    <Alert className="rounded-2xl border-emerald-300/20 bg-emerald-950/25 text-emerald-50">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      <AlertTitle>{success.title}</AlertTitle>
                      <AlertDescription>{success.message}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    className="h-12 w-full rounded-xl bg-[#f0e4d0] text-[#0a2830] shadow-[0_12px_30px_-16px_rgba(240,228,208,0.8)] hover:bg-[#fff8ec]"
                    disabled={pending || resetPending}
                    type="submit"
                  >
                    {pending ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    )}
                    {pending ? "Entrando..." : "Entrar"}
                  </Button>
                </form>

                <div className="mt-9 border-t border-white/[0.14] pt-6">
                  <p className="text-xs leading-5 text-white/45">
                    Seu progresso, suas tentativas e suas recomendações
                    permanecem vinculados à sua conta.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ThemeToggleButtonOnArtwork({
  onToggleTheme,
  theme,
}: {
  onToggleTheme: () => void;
  theme: ThemeMode;
}) {
  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;

  return (
    <Button
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      className="border-[#f2ead9]/40 bg-[#10353d]/70 text-[#f2ead9] hover:bg-[#10353d] hover:text-[#f2ead9]"
      onClick={onToggleTheme}
      size="sm"
      type="button"
      variant="outline"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{isDark ? "Tema claro" : "Tema escuro"}</span>
    </Button>
  );
}

function ThemeToggleButton({
  compact = false,
  onToggleTheme,
  theme,
}: {
  compact?: boolean;
  onToggleTheme: () => void;
  theme: ThemeMode;
}) {
  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;

  return (
    <Button
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      className={cn("shrink-0", compact && "h-9 w-9 p-0")}
      onClick={onToggleTheme}
      size={compact ? "icon" : "sm"}
      type="button"
      variant="outline"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {!compact && <span>{isDark ? "Tema claro" : "Tema escuro"}</span>}
    </Button>
  );
}

function IconImage({ className, src }: { className?: string; src: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        WebkitMask: `url(${src}) center / contain no-repeat`,
        mask: `url(${src}) center / contain no-repeat`,
      }}
    />
  );
}

function Sidebar({
  activeView,
  assessmentNotifications,
  diagnostics,
  examStats,
  onLogout,
  onNavigate,
  onToggleTheme,
  theme,
  user,
}: {
  activeView: ViewId;
  assessmentNotifications: AssessmentNotification[];
  diagnostics: Diagnostics;
  examStats: OfficialExamStats;
  onLogout: () => void;
  onNavigate: (view: ViewId) => void;
  onToggleTheme: () => void;
  theme: ThemeMode;
  user: StudyUser;
}) {
  return (
    <div className="flex h-screen flex-col gap-6 p-5">
      <BrandLogo />

      <nav className="space-y-1">
        {navItems.map((item) => (
          <Button
            className="w-full justify-start"
            key={item.id}
            onClick={() => onNavigate(item.id)}
            size="sm"
            variant={activeView === item.id ? "secondary" : "ghost"}
          >
            <IconImage className="h-4 w-4" src={item.iconSrc} />
            {item.label}
          </Button>
        ))}
      </nav>

      <div className="rounded-md border border-border bg-background/55 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Palette className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Interface</p>
              <p className="truncate text-xs text-muted-foreground">
                {theme === "dark" ? "Modo escuro ativo" : "Modo claro ativo"}
              </p>
            </div>
          </div>
          <ThemeToggleButton
            compact
            theme={theme}
            onToggleTheme={onToggleTheme}
          />
        </div>
      </div>

      <Card className="rounded-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Desempenho oficial</CardTitle>
          <CardDescription>
            {examStats.submittedAttempts.length} provas entregues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={examStats.averageScore} />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Média oficial</span>
            <span className="font-medium">{examStats.averageScore}%</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Pontos fracos</span>
            <Badge
              variant={
                diagnostics.weakTopics.length ? "destructive" : "secondary"
              }
            >
              {diagnostics.weakTopics.length}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {assessmentNotifications.length > 0 && (
        <Card className="rounded-md border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell
                className="h-4 w-4 text-amber-600 dark:text-amber-300"
                aria-hidden="true"
              />
              Próximo prazo
            </CardTitle>
            <CardDescription>
              {assessmentNotifications[0]?.message}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="mt-auto flex items-center gap-3 rounded-md border border-border p-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback>{initials(user.name || user.email)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Button
          aria-label="Sair"
          onClick={onLogout}
          size="icon"
          variant="ghost"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function TopBar({
  activeView,
  assessmentNotifications,
  diagnostics,
  examStats,
  onLogout,
  onNavigate,
  onToggleTheme,
  theme,
  user,
}: {
  activeView: ViewId;
  assessmentNotifications: AssessmentNotification[];
  diagnostics: Diagnostics;
  examStats: OfficialExamStats;
  onLogout: () => void;
  onNavigate: (view: ViewId) => void;
  onToggleTheme: () => void;
  theme: ThemeMode;
  user: StudyUser;
}) {
  const title = navItems.find((item) => item.id === activeView)?.label;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger
              render={
                <Button
                  aria-label="Abrir menu"
                  className="lg:hidden"
                  size="icon"
                  variant="ghost"
                />
              }
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent className="w-80" side="left">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3 text-left">
                  <BrandLogo compact />
                  <span>Cálculo em Foco</span>
                </SheetTitle>
              </SheetHeader>
              <Sidebar
                activeView={activeView}
                assessmentNotifications={assessmentNotifications}
                diagnostics={diagnostics}
                examStats={examStats}
                theme={theme}
                onLogout={onLogout}
                onNavigate={onNavigate}
                onToggleTheme={onToggleTheme}
                user={user}
              />
            </SheetContent>
          </Sheet>
          <div>
            <p className="text-sm text-muted-foreground">Área do aluno</p>
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBellMenu
            notifications={assessmentNotifications}
            onNavigate={onNavigate}
          />
          <div className="hidden items-center gap-2 sm:flex">
            <ThemeToggleButton theme={theme} onToggleTheme={onToggleTheme} />
            <Badge className="rounded-md" variant="secondary">
              {examStats.submittedAttempts.length} provas
            </Badge>
            <Badge className="rounded-md" variant="outline">
              {examStats.averageScore}% média
            </Badge>
          </div>
        </div>
      </div>
    </header>
  );
}

function NotificationBellMenu({
  notifications,
  onNavigate,
}: {
  notifications: AssessmentNotification[];
  onNavigate: (view: ViewId) => void;
}) {
  const [open, setOpen] = useState(false);
  const notificationCount = notifications.length;
  const hasNotifications = notificationCount > 0;

  return (
    <div className="relative">
      <Button
        aria-expanded={open}
        aria-label={
          hasNotifications
            ? `Abrir notificações: ${notificationCount} pendentes`
            : "Abrir notificações"
        }
        className="relative"
        onClick={() => setOpen((current) => !current)}
        size="icon"
        type="button"
        variant={hasNotifications ? "secondary" : "outline"}
      >
        <Bell
          className={cn(
            "h-4 w-4",
            hasNotifications && "text-amber-600 dark:text-amber-300",
          )}
          aria-hidden="true"
        />
        {hasNotifications && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.62rem] font-semibold leading-none text-primary-foreground">
            {notificationCount > 9 ? "9+" : notificationCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(23rem,calc(100vw-2rem))] rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Notificações
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Prazos e avisos calculados pela agenda de provas.
                </p>
              </div>
              <Badge
                className="rounded-md"
                variant={hasNotifications ? "secondary" : "outline"}
              >
                {notificationCount}
              </Badge>
            </div>

            <Separator />

            {hasNotifications ? (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {notifications.slice(0, 6).map((notification) => (
                  <div
                    className={cn(
                      "rounded-md border p-3",
                      notification.tone === "danger" &&
                        "border-rose-500/40 bg-rose-500/10",
                      notification.tone === "warning" &&
                        "border-amber-500/40 bg-amber-500/10",
                      notification.tone === "info" &&
                        "border-border bg-background/70",
                    )}
                    key={notification.id}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background/70 text-amber-600 dark:text-amber-300">
                        <Bell className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-5">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Prazo: {formatNotificationDate(notification.dueAt)}
                        </p>
                      </div>
                      <Badge
                        className="shrink-0 rounded-md"
                        variant={
                          notification.tone === "danger"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {formatNotificationStatus(notification)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border p-5 text-center">
                <CheckCircle2
                  className="mx-auto h-6 w-6 text-emerald-600 dark:text-emerald-300"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-medium">
                  Sem notificações agora
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Quando houver prova próxima, atraso ou aviso importante, ele
                  aparece aqui.
                </p>
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => {
                setOpen(false);
                onNavigate("provas");
              }}
              size="sm"
            >
              Abrir provas
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardView({
  attempts,
  assessments,
  assessmentNotifications,
  diagnostics,
  examStats,
  onNavigate,
  onStartExam,
  onStartPractice,
  practiceSummaries,
  referenceDate,
}: {
  attempts: Attempt[];
  assessments: OfficialAssessment[];
  assessmentNotifications: AssessmentNotification[];
  diagnostics: Diagnostics;
  examStats: OfficialExamStats;
  onNavigate: (view: ViewId) => void;
  onStartExam: (assessment: OfficialAssessment) => void;
  onStartPractice: (courseId: CourseId, topicId: string) => void;
  practiceSummaries: PracticeSessionSummary[];
  referenceDate: string;
}) {
  const nextAssessment = examStats.nextAssessment;
  const lastPractice = practiceSummaries[0];
  const practiceExerciseCount = practiceSummaries.reduce(
    (total, item) => total + item.total,
    0,
  );
  const urgentNotifications = assessmentNotifications.filter(
    (notification) => notification.daysUntilDue <= 3,
  );

  return (
    <div className="space-y-6">
      <ViewHeader
        description="Seu painel separa estudo livre de notas oficiais. Treinos e provas alimentam o diagnóstico; somente as provas compõem sua nota."
        iconSrc="/icons/nav-dashboard.svg"
        title="Hoje"
      />

      {urgentNotifications.length > 0 && (
        <AssessmentNotificationsPanel
          assessments={assessments}
          notifications={urgentNotifications}
          onStartExam={onStartExam}
        />
      )}

      {nextAssessment && (
        <Card className="rounded-md border-primary/35 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-md bg-primary p-3 text-primary-foreground">
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Próxima avaliação oficial
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {nextAssessment.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {describeAssessmentScope(nextAssessment)} ·{" "}
                  {formatAssessmentWindow(nextAssessment)}
                </p>
              </div>
            </div>
            <Button onClick={() => onStartExam(nextAssessment)}>
              Iniciar prova
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={`${examStats.submittedAttempts.length} provas oficiais entregues`}
          icon={GraduationCap}
          label="Média oficial"
          tone="text-emerald-600 dark:text-emerald-300"
          value={`${examStats.averageScore}%`}
        />
        <MetricCard
          detail={`${examStats.completedAssessments}/${examStats.totalAssessments} avaliações concluídas`}
          icon={Target}
          label="Melhor nota"
          tone="text-sky-600 dark:text-sky-300"
          value={`${examStats.bestScore}%`}
        />
        <MetricCard
          detail="Sinais combinados de prática e provas oficiais"
          icon={CircleAlert}
          label="Pontos fracos"
          tone="text-rose-600 dark:text-rose-300"
          value={String(diagnostics.weakTopics.length)}
        />
        <MetricCard
          detail={
            lastPractice
              ? `${lastPractice.correct}/${lastPractice.total} no último treino`
              : "Treinos não alteram sua nota oficial"
          }
          icon={ListChecks}
          label="Exercícios feitos"
          tone="text-amber-600 dark:text-amber-300"
          value={String(practiceExerciseCount)}
        />
      </div>

      <DashboardBoostPanel
        diagnostics={diagnostics}
        examStats={examStats}
        nextAssessment={nextAssessment}
        onNavigate={onNavigate}
        onStartExam={onStartExam}
        onStartPractice={onStartPractice}
        practiceExerciseCount={practiceExerciseCount}
      />

      {attempts.length === 0 && (
        <Alert className="rounded-md">
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Nenhum histórico de estudo ainda</AlertTitle>
          <AlertDescription>
            Comece por uma prática ou prova oficial. As duas geram diagnóstico,
            mas somente avaliações oficiais compõem sua nota.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-md">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>Domínio por disciplina</CardTitle>
                <CardDescription>
                  Cobertura de questões distintas e precisão em práticas e
                  provas.
                </CardDescription>
              </div>
              <Button
                onClick={() => onNavigate("trilhas")}
                size="sm"
                variant="secondary"
              >
                Ver trilhas
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {diagnostics.courseStats.map((stat) => {
              const course = getCourse(stat.courseId);
              const completion = stat.totalTopics
                ? (stat.completedTopics / stat.totalTopics) * 100
                : 0;

              return (
                <div
                  className="rounded-md border border-border p-4"
                  key={stat.courseId}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn("h-3 w-3 rounded-full", course?.accent)}
                      />
                      <div>
                        <p className="font-medium">{course?.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {stat.completedTopics}/{stat.totalTopics} tópicos
                          iniciados
                        </p>
                      </div>
                    </div>
                    <Badge className="rounded-md" variant="outline">
                      {stat.attempts ? percent(stat.accuracy) : "sem dados"}
                    </Badge>
                  </div>
                  <Progress className="mt-4" value={completion} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <RecommendationsPanel
          diagnostics={diagnostics}
          onStartPractice={onStartPractice}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>Provas oficiais</CardTitle>
            <CardDescription>
              Prazos, status e notas que realmente contam no dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {assessments.slice(0, 5).map((assessment) => {
              const status = getAssessmentStatusLabel(
                assessment,
                examStats.submittedAttempts,
                referenceDate,
              );
              const latestAttempt = examStats.submittedAttempts.find(
                (attempt) => attempt.assessmentId === assessment.id,
              );

              return (
                <div
                  className="rounded-md border border-border p-4"
                  key={assessment.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{assessment.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatAssessmentWindow(assessment)}
                      </p>
                    </div>
                    <Badge
                      className="rounded-md"
                      variant={status === "entregue" ? "secondary" : "outline"}
                    >
                      {status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Nota mínima</span>
                    <span className="font-medium">
                      {assessment.minimumScore}%
                    </span>
                  </div>
                  {latestAttempt ? (
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Sua nota</span>
                      <span className="font-semibold">
                        {latestAttempt.score}%
                      </span>
                    </div>
                  ) : (
                    <Button
                      className="mt-4 w-full"
                      onClick={() => onStartExam(assessment)}
                      size="sm"
                      variant="secondary"
                    >
                      Fazer prova
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
        <WeakTopicsPanel
          diagnostics={diagnostics}
          onStartPractice={onStartPractice}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentMistakesPanel
          attempts={diagnostics.recentMistakes}
          onStartPractice={onStartPractice}
        />
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>Atividade de treino</CardTitle>
            <CardDescription>
              Exercícios comuns ficam aqui como volume de estudo, sem virar
              falha oficial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {practiceSummaries.length === 0 && (
              <EmptyState
                description="Faça exercícios na aba Prática e finalize o treino para registrar volume de estudo nesta sessão."
                icon={ListChecks}
                title="Sem treinos finalizados"
              />
            )}
            {practiceSummaries.slice(0, 4).map((summary) => (
              <div
                className="rounded-md border border-border p-4"
                key={summary.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {getTopic(summary.topicId)?.title}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {getCourse(summary.courseId)?.title}
                    </p>
                  </div>
                  <Badge className="rounded-md" variant="outline">
                    {summary.correct}/{summary.total}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardBoostPanel({
  diagnostics,
  examStats,
  nextAssessment,
  onNavigate,
  onStartExam,
  onStartPractice,
  practiceExerciseCount,
}: {
  diagnostics: Diagnostics;
  examStats: OfficialExamStats;
  nextAssessment: OfficialAssessment | null;
  onNavigate: (view: ViewId) => void;
  onStartExam: (assessment: OfficialAssessment) => void;
  onStartPractice: (courseId: CourseId, topicId: string) => void;
  practiceExerciseCount: number;
}) {
  const weakTopic = diagnostics.weakTopics[0] ?? null;
  const weakTopicTitle = weakTopic
    ? (getTopic(weakTopic.topicId)?.title ?? "Tópico em revisão")
    : "Nenhum ponto fraco detectado";
  const officialCompletion = examStats.totalAssessments
    ? Math.round(
        (examStats.completedAssessments / examStats.totalAssessments) * 100,
      )
    : 0;
  const pendingAssessments = Math.max(
    0,
    examStats.totalAssessments - examStats.completedAssessments,
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="rounded-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Ações rápidas</CardTitle>
              <CardDescription>
                Continue pelo caminho mais útil para o seu momento.
              </CardDescription>
            </div>
            <span className="rounded-md bg-primary/10 p-2 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Button
            className="h-auto justify-start py-4 text-left"
            disabled={!nextAssessment}
            onClick={() => nextAssessment && onStartExam(nextAssessment)}
            variant="secondary"
          >
            <Trophy className="h-4 w-4" aria-hidden="true" />
            <span>
              <span className="block font-medium">Fazer próxima prova</span>
              <span className="block text-xs text-muted-foreground">
                {nextAssessment ? nextAssessment.title : "Sem prova pendente"}
              </span>
            </span>
          </Button>
          <Button
            className="h-auto justify-start py-4 text-left"
            disabled={!weakTopic}
            onClick={() =>
              weakTopic &&
              onStartPractice(weakTopic.courseId, weakTopic.topicId)
            }
            variant="outline"
          >
            <Brain className="h-4 w-4" aria-hidden="true" />
            <span>
              <span className="block font-medium">Treinar ponto fraco</span>
              <span className="block text-xs text-muted-foreground">
                {weakTopicTitle}
              </span>
            </span>
          </Button>
          <Button
            className="h-auto justify-start py-4 text-left"
            onClick={() => onNavigate("pratica")}
            variant="outline"
          >
            <Calculator className="h-4 w-4" aria-hidden="true" />
            <span>
              <span className="block font-medium">Prática livre</span>
              <span className="block text-xs text-muted-foreground">
                Escolha disciplina, tópico e questão
              </span>
            </span>
          </Button>
          <Button
            className="h-auto justify-start py-4 text-left"
            onClick={() => onNavigate("playlists")}
            variant="outline"
          >
            <Film className="h-4 w-4" aria-hidden="true" />
            <span>
              <span className="block font-medium">Abrir playlists</span>
              <span className="block text-xs text-muted-foreground">
                Teoria, resolução e pré-requisitos
              </span>
            </span>
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-md">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Roteiro de estudo</CardTitle>
              <CardDescription>
                Um mapa simples para equilibrar prazo, treino e revisão.
              </CardDescription>
            </div>
            <Badge className="rounded-md" variant="outline">
              {officialCompletion}% oficial
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={officialCompletion} />
          <div className="grid gap-3 sm:grid-cols-2">
            <LearningStep
              detail={
                nextAssessment
                  ? `Próximo prazo: ${formatAssessmentDueDate(nextAssessment)}`
                  : "Agenda oficial em dia"
              }
              icon={CalendarDays}
              label="Agenda"
              value={`${pendingAssessments} pendentes`}
            />
            <LearningStep
              detail="Treinos não alteram sua nota oficial."
              icon={Calculator}
              label="Prática"
              value={`${practiceExerciseCount} exercícios`}
            />
            <LearningStep
              detail="Prática e provas alimentam o diagnóstico."
              icon={Trophy}
              label="Provas"
              value={`${examStats.submittedAttempts.length} entregues`}
            />
            <LearningStep
              detail={
                weakTopic
                  ? `${getCourse(weakTopic.courseId)?.shortTitle ?? "Curso"} / ${weakTopicTitle}`
                  : "Continue resolvendo para gerar sinais"
              }
              icon={Brain}
              label="Revisão"
              value={`${diagnostics.weakTopics.length} pontos fracos`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LearningStep({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: typeof Target;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background/55 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="truncate font-semibold">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}

function AssessmentNotificationsPanel({
  assessments,
  notifications,
  onStartExam,
}: {
  assessments: OfficialAssessment[];
  notifications: AssessmentNotification[];
  onStartExam: (assessment: OfficialAssessment) => void;
}) {
  if (notifications.length === 0) {
    return (
      <Alert className="rounded-md border-emerald-500/30">
        <CheckCircle2
          className="h-4 w-4 text-emerald-600 dark:text-emerald-300"
          aria-hidden="true"
        />
        <AlertTitle>Sem prazos pendentes</AlertTitle>
        <AlertDescription>
          Você não tem provas oficiais pendentes no momento.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="rounded-md border-amber-500/25 bg-amber-500/5">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell
                className="h-5 w-5 text-amber-600 dark:text-amber-300"
                aria-hidden="true"
              />
              Notificações de prova
            </CardTitle>
            <CardDescription>
              Avisos automáticos calculados pela agenda oficial.
            </CardDescription>
          </div>
          <Badge className="rounded-md" variant="secondary">
            {notifications.length} pendentes
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-2">
        {notifications.slice(0, 4).map((notification) => {
          const assessment = assessments.find(
            (item) => item.id === notification.assessmentId,
          );

          return (
            <div
              className={cn(
                "rounded-md border p-4",
                notification.tone === "danger" &&
                  "border-rose-500/40 bg-rose-500/10",
                notification.tone === "warning" &&
                  "border-amber-500/40 bg-amber-500/10",
                notification.tone === "info" &&
                  "border-border bg-background/65",
              )}
              key={notification.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{notification.message}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Prazo:{" "}
                    {assessment
                      ? formatAssessmentDueDate(assessment)
                      : new Date(notification.dueAt).toLocaleDateString(
                          "pt-BR",
                        )}
                  </p>
                </div>
                <Badge
                  className="rounded-md"
                  variant={
                    notification.tone === "danger" ? "destructive" : "outline"
                  }
                >
                  {notification.daysUntilDue < 0
                    ? "atrasada"
                    : notification.daysUntilDue === 0
                      ? "hoje"
                      : `${notification.daysUntilDue}d`}
                </Badge>
              </div>
              {assessment && (
                <Button
                  className="mt-4 w-full"
                  onClick={() => onStartExam(assessment)}
                  size="sm"
                  variant="secondary"
                >
                  Abrir prova
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function TrailsView({
  attempts,
  diagnostics,
  onStartPractice,
  questions,
}: {
  attempts: Attempt[];
  diagnostics: Diagnostics;
  onStartPractice: (courseId: CourseId, topicId: string) => void;
  questions: Question[];
}) {
  return (
    <div className="space-y-6">
      <ViewHeader
        description="Sequência de estudo por disciplina, com base matemática antes de Cálculo."
        iconSrc="/icons/nav-trilhas.svg"
        title="Trilhas"
      />
      <div className="grid gap-6 xl:grid-cols-2">
        {courses.map((course) => (
          <Card className="rounded-md" key={course.id}>
            <CardHeader>
              <div className="mb-3 flex items-center gap-3">
                <span className={cn("h-3 w-3 rounded-full", course.accent)} />
                <Badge className="rounded-md" variant="secondary">
                  {course.shortTitle}
                </Badge>
              </div>
              <CardTitle>{course.title}</CardTitle>
              <CardDescription>{course.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {getTopicsByCourse(course.id).map((topic) => {
                const stat = diagnostics.topicStats.find(
                  (item) => item.topicId === topic.id,
                );
                const progress = getQuestionProgress(
                  questions,
                  attempts,
                  topic.id,
                );

                return (
                  <div
                    className="rounded-md border border-border p-4"
                    key={topic.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{topic.title}</p>
                          {stat?.weak && (
                            <Badge variant="destructive">revisar</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {topic.description}
                        </p>
                      </div>
                      <Button
                        onClick={() => onStartPractice(course.id, topic.id)}
                        size="sm"
                        variant="secondary"
                      >
                        Praticar
                        <Play className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                      <Progress value={progress.percent} />
                      <span className="text-sm text-muted-foreground">
                        {progress.answered}/{progress.total} questões
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PrerequisitesView({
  diagnostics,
  onStartPractice,
}: {
  diagnostics: Diagnostics;
  onStartPractice: (courseId: CourseId, topicId: string) => void;
}) {
  return (
    <div className="space-y-6">
      <ViewHeader
        description="Fundamentos que mais aparecem em limites, derivadas, integrais e cálculo vetorial."
        iconSrc="/icons/nav-pre-requisitos.svg"
        title="Pré-requisitos"
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {prerequisites.map((prerequisite) => {
          const stat = diagnostics.prerequisiteStats.find(
            (item) => item.prerequisiteId === prerequisite.id,
          );
          const firstTopic = prerequisite.topicIds
            .map((topicId) => getTopic(topicId))
            .find(Boolean);

          return (
            <Card className="rounded-md" key={prerequisite.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">
                      {prerequisite.title}
                    </CardTitle>
                    <CardDescription>
                      {prerequisite.description}
                    </CardDescription>
                  </div>
                  <Badge variant={stat?.weak ? "destructive" : "secondary"}>
                    {stat?.attempts ? percent(stat.accuracy) : "sem dados"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={(stat?.accuracy ?? 0) * 100} />
                <div className="flex flex-wrap gap-2">
                  {prerequisite.examples.map((example) => (
                    <Badge
                      className="rounded-md font-mono"
                      key={example}
                      variant="outline"
                    >
                      {example}
                    </Badge>
                  ))}
                </div>
                {firstTopic && (
                  <Button
                    className="w-full"
                    onClick={() =>
                      onStartPractice(firstTopic.courseId, firstTopic.id)
                    }
                    variant="secondary"
                  >
                    Revisar agora
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PracticeView({
  activeQuestion,
  feedback,
  filteredQuestions,
  onAnswerQuestion,
  onFinishPractice,
  onMoveToNextQuestion,
  onSelectCourse,
  onSelectOption,
  onSelectQuestion,
  onSelectTopic,
  selectedCourseId,
  selectedOptionId,
  selectedTopicId,
  sessionAnswers,
}: {
  activeQuestion: Question | null;
  feedback: Feedback | null;
  filteredQuestions: Question[];
  onAnswerQuestion: () => Promise<void>;
  onFinishPractice: () => void;
  onMoveToNextQuestion: () => void;
  onSelectCourse: (courseId: CourseId) => void;
  onSelectOption: (optionId: string) => void;
  onSelectQuestion: (questionId: string) => void;
  onSelectTopic: (topicId: string) => void;
  selectedCourseId: CourseId;
  selectedOptionId: string | null;
  selectedTopicId: string;
  sessionAnswers: PracticeSessionAnswer[];
}) {
  const selectedTopic = getTopic(selectedTopicId);
  const topicSessionAnswers = sessionAnswers.filter(
    (answer) =>
      answer.courseId === selectedCourseId &&
      answer.topicId === selectedTopicId,
  );
  const topicSessionCorrect = topicSessionAnswers.filter(
    (answer) => answer.correct,
  ).length;

  return (
    <div className="space-y-6">
      <ViewHeader
        description="Escolha uma disciplina e treine sem pressão. A prática melhora o diagnóstico, mas nunca altera sua nota oficial."
        iconSrc="/icons/nav-pratica.svg"
        title="Prática"
      />
      <Card className="rounded-md">
        <CardContent className="grid gap-4 p-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="practice-course">Disciplina</Label>
            <Select
              value={selectedCourseId}
              onValueChange={(value) =>
                value && onSelectCourse(value as CourseId)
              }
            >
              <SelectTrigger id="practice-course">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="practice-topic">Tópico</Label>
            <Select
              value={selectedTopicId}
              onValueChange={(value) => value && onSelectTopic(value)}
            >
              <SelectTrigger id="practice-topic">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getTopicsByCourse(selectedCourseId).map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">Treino atual</p>
            <div className="mt-1 flex items-center justify-between">
              <p className="font-medium">
                {topicSessionAnswers.length
                  ? `${topicSessionCorrect}/${topicSessionAnswers.length}`
                  : "sem respostas"}
              </p>
              <Badge variant="secondary">temporário</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      <Alert className="rounded-md border-emerald-500/30">
        <CheckCircle2
          className="h-4 w-4 text-emerald-600 dark:text-emerald-300"
          aria-hidden="true"
        />
        <AlertTitle>Treino formativo, nota preservada</AlertTitle>
        <AlertDescription>
          Use esta área para errar, consultar explicações e revisar vídeos. O
          diagnóstico aprende com a prática; a nota continua restrita às provas.
        </AlertDescription>
      </Alert>
      <div className="grid gap-6 xl:grid-cols-[0.34fr_0.66fr]">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-lg">Questões do tópico</CardTitle>
            <CardDescription>
              {filteredQuestions.length} questões em {selectedTopic?.title}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80 pr-3">
              <div className="space-y-2">
                {filteredQuestions.map((question, index) => (
                  <button
                    className={cn(
                      "w-full rounded-md border border-border p-3 text-left text-sm transition hover:bg-accent",
                      activeQuestion?.id === question.id && "bg-accent",
                    )}
                    key={question.id}
                    onClick={() => onSelectQuestion(question.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">Questão {index + 1}</span>
                      <Badge className="rounded-md" variant="outline">
                        {question.difficulty}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-muted-foreground">
                      {question.prompt}
                    </p>
                  </button>
                ))}
                {filteredQuestions.length === 0 && (
                  <EmptyState
                    description="Importe questões ou escolha outro tópico para praticar."
                    icon={ClipboardList}
                    title="Nenhuma questão neste tópico"
                  />
                )}
              </div>
            </ScrollArea>
          </CardContent>
          <CardContent className="border-t border-border pt-4">
            <Button
              className="w-full"
              disabled={topicSessionAnswers.length === 0}
              onClick={onFinishPractice}
              variant="secondary"
            >
              Finalizar treino
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            </Button>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Ao finalizar, o app registra apenas o volume desta sessão na tela
              inicial. Erros não viram histórico oficial.
            </p>
          </CardContent>
        </Card>
        <QuestionCard
          feedback={feedback}
          onAnswerQuestion={onAnswerQuestion}
          onMoveToNextQuestion={onMoveToNextQuestion}
          onSelectOption={onSelectOption}
          question={activeQuestion}
          selectedOptionId={selectedOptionId}
        />
      </div>
    </div>
  );
}

function QuestionCard({
  feedback,
  onAnswerQuestion,
  onMoveToNextQuestion,
  onSelectOption,
  question,
  selectedOptionId,
}: {
  feedback: Feedback | null;
  onAnswerQuestion: () => Promise<void>;
  onMoveToNextQuestion: () => void;
  onSelectOption: (optionId: string) => void;
  question: Question | null;
  selectedOptionId: string | null;
}) {
  const [pending, setPending] = useState(false);

  if (!question) {
    return (
      <Card className="rounded-md">
        <CardContent className="p-6">
          <EmptyState
            description="Escolha outro tópico ou importe novas questões."
            icon={ClipboardList}
            title="Sem questão selecionada"
          />
        </CardContent>
      </Card>
    );
  }

  async function handleAnswer() {
    setPending(true);
    await onAnswerQuestion();
    setPending(false);
  }

  const videos = getVideosForQuestion(question);

  return (
    <Card className="rounded-md border-primary/15 bg-card/95 shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-md" variant="secondary">
            {getCourse(question.courseId)?.title}
          </Badge>
          <Badge className="rounded-md" variant="outline">
            {getTopic(question.topicId)?.title}
          </Badge>
          <Badge className="rounded-md" variant="outline">
            {question.difficulty}
          </Badge>
        </div>
        <CardTitle className="leading-8">{question.prompt}</CardTitle>
        <CardDescription>
          Feedback imediato de treino. Esta resposta não altera suas notas
          oficiais.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <fieldset className="grid gap-3">
          <legend className="sr-only">Escolha uma alternativa</legend>
          {question.options.map((option) => {
            const isSelected = selectedOptionId === option.id;
            const isCorrect =
              feedback && option.id === question.correctOptionId;
            const isWrong =
              feedback && isSelected && option.id !== question.correctOptionId;

            return (
              <label
                className={cn(
                  "flex min-h-14 cursor-pointer items-start gap-3 rounded-md border border-border p-4 text-left transition hover:bg-accent focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                  (feedback || pending) && "cursor-not-allowed opacity-80",
                  isSelected && "border-primary bg-accent",
                  isCorrect && "border-emerald-500/70 bg-emerald-500/10",
                  isWrong && "border-rose-500/70 bg-rose-500/10",
                )}
                key={option.id}
              >
                <input
                  checked={isSelected}
                  className="sr-only"
                  disabled={Boolean(feedback) || pending}
                  name={`practice-${question.id}`}
                  onChange={() => onSelectOption(option.id)}
                  type="radio"
                  value={option.id}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border font-mono text-sm uppercase",
                    isSelected &&
                      "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {option.id}
                </span>
                <span className="leading-6">{option.text}</span>
              </label>
            );
          })}
        </fieldset>

        {feedback && (
          <Alert
            className={cn(
              "rounded-md",
              feedback.correct ? "border-emerald-500/40" : "border-rose-500/40",
            )}
          >
            {feedback.correct ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-300" />
            )}
            <AlertTitle>
              {feedback.correct ? "Resposta correta" : "Resposta incorreta"}
            </AlertTitle>
            <AlertDescription>
              <p>Correta: {feedback.correctOptionText}</p>
              <p>{feedback.explanation}</p>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            disabled={!selectedOptionId || Boolean(feedback) || pending}
            onClick={handleAnswer}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <SearchCheck className="h-4 w-4" aria-hidden="true" />
            )}
            Confirmar treino
          </Button>
          <Button
            disabled={!feedback}
            onClick={onMoveToNextQuestion}
            variant="secondary"
          >
            Próxima questão
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {question.prerequisiteIds.map((id) => (
            <Badge className="rounded-md" key={id} variant="outline">
              {getPrerequisite(id)?.title ?? id}
            </Badge>
          ))}
        </div>

        <QuestionVideosPanel videos={videos} />
      </CardContent>
    </Card>
  );
}

function QuestionVideosPanel({ videos }: { videos: QuestionVideos }) {
  const featured =
    videos.practice[0] ?? videos.theory[0] ?? videos.prerequisite[0] ?? null;

  return (
    <section className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--brand-calm)]">
            <Video className="h-4 w-4" aria-hidden="true" />
            Vídeos para esta questão
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Vídeos individuais em português, ligados a esta questão e ordenados
            por relação direta e visualizações.
          </p>
        </div>
        {featured && (
          <a
            className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 text-[0.8rem] font-medium transition hover:bg-muted"
            href={featured.youtubeUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Abrir no YouTube
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>

      {featured && (
        <div className="overflow-hidden rounded-md border border-border bg-background">
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="aspect-video w-full"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            src={featured.embedUrl}
            title={`Vídeo: ${featured.title}`}
          />
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        <VideoPlaylist
          description="Exercícios resolvidos do assunto da questão."
          title="Prática e resolução"
          videos={videos.practice}
        />
        <VideoPlaylist
          description="Explicação conceitual para organizar a teoria."
          title="Teoria e fundamentos"
          videos={videos.theory}
        />
        <VideoPlaylist
          description="Álgebra, funções e geometria necessárias antes do tópico."
          title="Pré-requisitos para entender"
          videos={videos.prerequisite}
        />
      </div>
    </section>
  );
}

function VideoPlaylist({
  description,
  title,
  videos,
}: {
  description: string;
  title: string;
  videos: VideoResource[];
}) {
  return (
    <div className="rounded-md border border-border bg-background/60 p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
      <div className="mt-3 space-y-2">
        {videos.length > 0 ? (
          videos.map((video) => (
            <a
              className="block rounded-md border border-border/70 p-3 text-sm transition hover:border-primary/60 hover:bg-accent"
              href={video.youtubeUrl}
              key={video.id}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="font-medium leading-5">{video.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {video.channel}
                  </span>
                </span>
                <ExternalLink
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </span>
              <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                {video.description}
              </span>
              <span className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-md bg-muted px-2 py-1">
                  Playlist: {video.sourcePlaylistTitle}
                </span>
                {video.viewCount && (
                  <span className="rounded-md bg-muted px-2 py-1">
                    {formatViews(video.viewCount)} visualizações
                  </span>
                )}
                {video.publishedAt && (
                  <span className="rounded-md bg-muted px-2 py-1">
                    Publicado em {formatPublishedAt(video.publishedAt)}
                  </span>
                )}
              </span>
            </a>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
            Sem vídeo curado para este grupo ainda.
          </p>
        )}
      </div>
    </div>
  );
}

function formatViews(viewCount: number) {
  if (viewCount >= 1_000_000) {
    const value = viewCount / 1_000_000;
    return `${value.toFixed(value >= 10 ? 0 : 1).replace(".", ",")} mi`;
  }

  if (viewCount >= 1_000) {
    return `${Math.round(viewCount / 1_000)} mil`;
  }

  return String(viewCount);
}

function formatPublishedAt(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function ExamsView({
  activeSession,
  assessments,
  attempts,
  notifications,
  onCancelSession,
  onRecordQuestionTime,
  onSelectAnswer,
  onStartExam,
  onSubmitExam,
  pending,
  referenceDate,
}: {
  activeSession: OfficialExamSession | null;
  assessments: OfficialAssessment[];
  attempts: ExamAttempt[];
  notifications: AssessmentNotification[];
  onCancelSession: () => void;
  onRecordQuestionTime: (questionId: string, seconds: number) => void;
  onSelectAnswer: (questionId: string, optionId: string) => void;
  onStartExam: (assessment: OfficialAssessment) => void;
  onSubmitExam: (finalTiming?: {
    questionId: string;
    seconds: number;
  }) => Promise<boolean>;
  pending: boolean;
  referenceDate: string;
}) {
  const examStats = buildOfficialExamStats(
    assessments,
    attempts,
    referenceDate,
  );

  if (activeSession) {
    return (
      <OfficialExamRunner
        pending={pending}
        session={activeSession}
        onCancelSession={onCancelSession}
        onRecordQuestionTime={onRecordQuestionTime}
        onSelectAnswer={onSelectAnswer}
        onSubmitExam={onSubmitExam}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ViewHeader
        description="Avaliações oficiais com sorteio de questões, tempo calculado por dificuldade e resultado salvo no Supabase."
        iconSrc="/icons/nav-provas.svg"
        title="Provas oficiais"
      />

      {notifications.length > 0 && (
        <Alert className="rounded-md border-amber-500/35">
          <Bell
            className="h-4 w-4 text-amber-600 dark:text-amber-300"
            aria-hidden="true"
          />
          <AlertTitle>{notifications[0]?.message}</AlertTitle>
          <AlertDescription>
            O prazo mais próximo fica destacado; os cards abaixo mostram todas
            as provas disponíveis, programadas ou atrasadas.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          detail="Baseada apenas em provas entregues"
          icon={LineChart}
          label="Média oficial"
          tone="text-emerald-600 dark:text-emerald-300"
          value={`${examStats.averageScore}%`}
        />
        <MetricCard
          detail={`${examStats.completedAssessments}/${examStats.totalAssessments} avaliações`}
          icon={CheckCircle2}
          label="Conclusão"
          tone="text-sky-600 dark:text-sky-300"
          value={`${Math.round(
            (examStats.completedAssessments /
              Math.max(1, examStats.totalAssessments)) *
              100,
          )}%`}
        />
        <MetricCard
          detail="Prazos vencidos ou atrasados"
          icon={CalendarDays}
          label="Pendências"
          tone="text-amber-600 dark:text-amber-300"
          value={String(examStats.overdueAssessments.length)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {assessments.map((assessment) => (
          <ExamAssessmentCard
            assessment={assessment}
            attempts={attempts}
            key={assessment.id}
            onStartExam={onStartExam}
            referenceDate={referenceDate}
          />
        ))}
      </div>
    </div>
  );
}

function ExamAssessmentCard({
  assessment,
  attempts,
  onStartExam,
  referenceDate,
}: {
  assessment: OfficialAssessment;
  attempts: ExamAttempt[];
  onStartExam: (assessment: OfficialAssessment) => void;
  referenceDate: string;
}) {
  const status = getAssessmentStatusLabel(assessment, attempts, referenceDate);
  const assessmentAttempts = attempts.filter(
    (attempt) => attempt.assessmentId === assessment.id,
  );
  const bestAttempt = assessmentAttempts
    .filter(
      (attempt) => attempt.status === "submitted" || attempt.status === "late",
    )
    .sort((left, right) => right.score - left.score)[0];
  const inProgress = assessmentAttempts.find(
    (attempt) => attempt.status === "in_progress",
  );
  const usedAttempts = assessmentAttempts.filter(
    (attempt) => attempt.status !== "in_progress",
  ).length;
  const attemptsLeft = Math.max(0, assessment.maxAttempts - usedAttempts);
  const disabled =
    !inProgress &&
    (status === "expirada" || status === "programada" || attemptsLeft === 0);

  return (
    <Card className="rounded-md">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{assessment.title}</CardTitle>
            <CardDescription className="mt-1 leading-6">
              {assessment.description}
            </CardDescription>
          </div>
          <Badge
            className="rounded-md"
            variant={status === "disponível" ? "secondary" : "outline"}
          >
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricInline
            label="Questões"
            value={String(assessment.questionCount)}
          />
          <MetricInline
            label="Nota mínima"
            value={`${assessment.minimumScore}%`}
          />
          <MetricInline
            label="Tentativas"
            value={`${attemptsLeft}/${assessment.maxAttempts}`}
          />
        </div>
        <div className="rounded-md border border-border p-3 text-sm">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {describeAssessmentScope(assessment)}
              </p>
              <p className="mt-1 text-muted-foreground">
                {formatAssessmentWindow(assessment)}
              </p>
            </div>
          </div>
        </div>
        {bestAttempt && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            Melhor resultado:{" "}
            <span className="font-semibold">{bestAttempt.score}%</span> (
            {bestAttempt.correctCount}/{bestAttempt.questionCount})
          </div>
        )}
        <Button
          className="w-full"
          disabled={disabled}
          onClick={() => onStartExam(assessment)}
        >
          {inProgress
            ? "Retomar prova"
            : bestAttempt
              ? "Refazer prova"
              : "Iniciar prova"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
}

function AdminView({
  assessments,
  onSaveAssessment,
  user,
}: {
  assessments: OfficialAssessment[];
  onSaveAssessment: (assessment: OfficialAssessment) => Promise<boolean>;
  user: StudyUser;
}) {
  if (user.role !== "admin") {
    return (
      <div className="space-y-6">
        <ViewHeader
          description="Configurações administrativas ficam disponíveis apenas para perfis admin."
          iconSrc="/icons/nav-admin.svg"
          title="Admin"
        />
        <Alert className="rounded-md" variant="destructive">
          <CircleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>
            Seu perfil atual não tem permissão para alterar provas e regras.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ViewHeader
        description="Controle datas de prova, nota mínima, número de tentativas e quantidade de questões."
        iconSrc="/icons/nav-admin.svg"
        title="Admin"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          detail="Provas temáticas e agendadas"
          icon={GraduationCap}
          label="Avaliações"
          tone="text-sky-600 dark:text-sky-300"
          value={String(assessments.length)}
        />
        <MetricCard
          detail="Base por dificuldade"
          icon={Timer}
          label="Tempo"
          tone="text-amber-600 dark:text-amber-300"
          value="2/4/7 min"
        />
        <MetricCard
          detail="Padrão inicial"
          icon={Target}
          label="Nota mínima"
          tone="text-emerald-600 dark:text-emerald-300"
          value="70%"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {assessments.map((assessment) => (
          <AdminAssessmentCard
            assessment={assessment}
            key={assessment.id}
            onSaveAssessment={onSaveAssessment}
          />
        ))}
      </div>
    </div>
  );
}

function AdminAssessmentCard({
  assessment,
  onSaveAssessment,
}: {
  assessment: OfficialAssessment;
  onSaveAssessment: (assessment: OfficialAssessment) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(assessment);
  const [pending, setPending] = useState(false);
  const fieldId = (name: string) => `${assessment.id}-${name}`;

  async function handleSave() {
    setPending(true);
    await onSaveAssessment(draft);
    setPending(false);
  }

  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle>{assessment.title}</CardTitle>
        <CardDescription>{describeAssessmentScope(assessment)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={fieldId("available-at")}>Disponível em</Label>
            <Input
              id={fieldId("available-at")}
              type="datetime-local"
              value={toDateTimeLocalValue(draft.availableAt)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  availableAt: fromDateTimeLocalValue(event.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={fieldId("due-at")}>Prazo final</Label>
            <Input
              id={fieldId("due-at")}
              type="datetime-local"
              value={toDateTimeLocalValue(draft.dueAt)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  dueAt: fromDateTimeLocalValue(event.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={fieldId("question-count")}>Questões</Label>
            <Input
              id={fieldId("question-count")}
              min={1}
              type="number"
              value={draft.questionCount}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  questionCount: Number(event.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={fieldId("minimum-score")}>Nota mínima (%)</Label>
            <Input
              id={fieldId("minimum-score")}
              max={100}
              min={0}
              type="number"
              value={draft.minimumScore}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  minimumScore: Number(event.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={fieldId("max-attempts")}>Tentativas</Label>
            <Input
              id={fieldId("max-attempts")}
              min={1}
              type="number"
              value={draft.maxAttempts}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  maxAttempts: Number(event.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={fieldId("deadline-policy")}>Após o prazo</Label>
            <Select
              value={draft.deadlinePolicy}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  deadlinePolicy: value as OfficialAssessment["deadlinePolicy"],
                }))
              }
            >
              <SelectTrigger id={fieldId("deadline-policy")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="late">Fica atrasada</SelectItem>
                <SelectItem value="expire">Expira</SelectItem>
                <SelectItem value="available">Continua disponível</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button disabled={pending} onClick={handleSave}>
          {pending && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          Salvar configuração
        </Button>
      </CardContent>
    </Card>
  );
}

function PlaylistsView({ questions }: { questions: Question[] }) {
  const groups: Array<{
    accent: string;
    description: string;
    focus: string;
    iconSrc: string;
    kind: VideoResource["kind"];
    title: string;
  }> = [
    {
      accent: "border-l-coral/80",
      focus: "Treino guiado",
      iconSrc: "/icons/playlist-practice.svg",
      kind: "practice",
      title: "Prática e resolução",
      description:
        "Vídeos de exercícios resolvidos conectados às questões do app.",
    },
    {
      accent: "border-l-sky-400/80",
      focus: "Conceito antes da conta",
      iconSrc: "/icons/playlist-theory.svg",
      kind: "theory",
      title: "Teoria e fundamentos",
      description:
        "Aulas conceituais para entender o assunto antes de praticar.",
    },
    {
      accent: "border-l-emerald-400/80",
      focus: "Base matemática",
      iconSrc: "/icons/playlist-prerequisite.svg",
      kind: "prerequisite",
      title: "Pré-requisitos para entender",
      description:
        "Base de álgebra, funções, trigonometria e geometria analítica.",
    },
  ];

  return (
    <div className="space-y-6">
      <ViewHeader
        description="Três playlists internas curadas por questão, com vídeos individuais ordenados por relação direta, atualidade e visualizações."
        iconSrc="/icons/nav-playlists.svg"
        title="Playlists"
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {groups.map((group) => {
          const videos = getPlaylistVideos(group.kind);
          const featuredVideo = videos[0];
          const totalViews = videos.reduce(
            (total, video) => total + (video.viewCount ?? 0),
            0,
          );
          const relatedQuestionCount = new Set(
            videos.flatMap((video) => video.questionIds ?? []),
          ).size;
          const playlistUrl = internalPlaylistUrls[group.kind];

          return (
            <Card
              className={cn(
                "rounded-lg border-l-4 bg-card/65 shadow-none",
                group.accent,
              )}
              key={group.kind}
              size="sm"
            >
              <CardHeader className="border-b border-border/70 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                      <IconImage className="size-5" src={group.iconSrc} />
                    </span>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {group.focus}
                      </p>
                      <CardTitle className="mt-1 text-lg">
                        {group.title}
                      </CardTitle>
                    </div>
                  </div>
                  <Badge className="rounded-md" variant="secondary">
                    {videos.length} vídeos
                  </Badge>
                </div>
                <CardDescription className="leading-6">
                  {group.description}
                </CardDescription>
                <a
                  className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted"
                  href={playlistUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Abrir playlist no YouTube
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="grid grid-cols-3 gap-2">
                  <PlaylistMetric
                    label="Views"
                    value={formatViews(totalViews)}
                  />
                  <PlaylistMetric
                    label="Questões"
                    value={String(relatedQuestionCount)}
                  />
                  <PlaylistMetric
                    label="Fonte"
                    value={
                      featuredVideo?.sourcePlaylistTitle === group.title
                        ? "Interna"
                        : "Curada"
                    }
                  />
                </div>

                {featuredVideo ? (
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-md border border-border bg-background">
                      <iframe
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="aspect-video w-full"
                        loading="lazy"
                        src={`${featuredVideo.embedUrl}?rel=0`}
                        title={featuredVideo.title}
                      />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Vídeo de abertura
                        </p>
                        <h3 className="mt-1 text-sm font-semibold leading-6">
                          {featuredVideo.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {featuredVideo.channel}
                        </p>
                      </div>
                      <a
                        aria-label={`Abrir ${featuredVideo.title} no YouTube`}
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background transition hover:bg-muted"
                        href={featuredVideo.youtubeUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-border p-3 text-sm leading-6 text-muted-foreground">
                    Sem vídeos curados nesta playlist ainda.
                  </p>
                )}

                <Separator />

                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">
                    Biblioteca da playlist
                  </p>
                  <Badge className="rounded-md" variant="outline">
                    Mais vistos primeiro
                  </Badge>
                </div>

                <ScrollArea className="h-[520px] pr-3">
                  <div className="space-y-4">
                    {videos.map((video, index) => (
                      <PlaylistLibraryItem
                        key={video.id}
                        questions={questions}
                        rank={index + 1}
                        video={video}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PlaylistMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/55 p-3">
      <p className="text-[0.72rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function getPlaylistVideos(kind: VideoResource["kind"]) {
  return videoResources
    .filter((video) => video.kind === kind)
    .sort((left, right) => (right.viewCount ?? 0) - (left.viewCount ?? 0));
}

function PlaylistLibraryItem({
  questions,
  rank,
  video,
}: {
  questions: Question[];
  rank: number;
  video: VideoResource;
}) {
  const relatedQuestions = (video.questionIds ?? [])
    .map((questionId) =>
      questions.find((question) => question.id === questionId),
    )
    .filter((question): question is Question => Boolean(question));

  return (
    <article className="border-b border-border/70 pb-4 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs text-muted-foreground">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold leading-6">{video.title}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{video.channel}</p>
        </div>
        <a
          aria-label={`Abrir ${video.title} no YouTube`}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background transition hover:bg-muted"
          href={video.youtubeUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {video.description}
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {video.sourcePlaylistUrl ? (
          <a
            className="rounded-md bg-muted px-2 py-1 transition hover:text-foreground"
            href={video.sourcePlaylistUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Playlist: {video.sourcePlaylistTitle}
          </a>
        ) : (
          <span className="rounded-md bg-muted px-2 py-1">
            Playlist: {video.sourcePlaylistTitle}
          </span>
        )}
        {video.viewCount && (
          <span className="rounded-md bg-muted px-2 py-1">
            {formatViews(video.viewCount)} visualizações
          </span>
        )}
        {video.publishedAt && (
          <span className="rounded-md bg-muted px-2 py-1">
            Publicado em {formatPublishedAt(video.publishedAt)}
          </span>
        )}
      </div>

      {relatedQuestions.length > 0 && (
        <details className="mt-4 rounded-md border border-border bg-muted/20 p-3">
          <summary className="cursor-pointer text-sm font-medium">
            {relatedQuestions.length}{" "}
            {relatedQuestions.length === 1
              ? "questão relacionada"
              : "questões relacionadas"}
          </summary>
          <ul className="mt-3 space-y-2">
            {relatedQuestions.map((question) => (
              <li
                className="text-sm leading-6 text-muted-foreground"
                key={question.id}
              >
                <span className="font-medium text-foreground">
                  {getCourse(question.courseId)?.shortTitle} /{" "}
                  {getTopic(question.topicId)?.title}:
                </span>{" "}
                {question.prompt}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function ImportView({
  importedQuestions,
  onImport,
  onResetImported,
}: {
  importedQuestions: Question[];
  onImport: (questions: Question[]) => Promise<boolean>;
  onResetImported: () => Promise<void>;
}) {
  const [rawInput, setRawInput] = useState(importExample);
  const [errors, setErrors] = useState<string[]>([]);
  const [previewCount, setPreviewCount] = useState(0);
  const [pending, setPending] = useState(false);

  async function validateAndImport() {
    const result = parseQuestionImport(rawInput);
    setErrors(result.errors);
    setPreviewCount(result.questions.length);

    if (result.errors.length === 0 && result.questions.length > 0) {
      setPending(true);
      await onImport(result.questions);
      setPending(false);
    }
  }

  function validateOnly() {
    const result = parseQuestionImport(rawInput);
    setErrors(result.errors);
    setPreviewCount(result.questions.length);
  }

  return (
    <div className="space-y-6">
      <ViewHeader
        description="Cole CSV ou JSON para expandir seu banco de questões."
        iconSrc="/icons/nav-importacao.svg"
        title="Importação de questões"
      />
      <div className="grid gap-6 xl:grid-cols-[0.65fr_0.35fr]">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>Entrada CSV/JSON</CardTitle>
            <CardDescription>
              As questões importadas ficam vinculadas à sua conta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              className="min-h-80 font-mono text-sm"
              value={rawInput}
              onChange={(event) => setRawInput(event.target.value)}
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button disabled={pending} onClick={validateAndImport}>
                {pending ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Upload className="h-4 w-4" aria-hidden="true" />
                )}
                Importar
              </Button>
              <Button onClick={validateOnly} variant="secondary">
                Validar
                <SearchCheck className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button onClick={onResetImported} variant="outline">
                Limpar importadas
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>
              Resultado da validação e importação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MetricInline
              label="Válidas no texto"
              value={String(previewCount)}
            />
            <MetricInline
              label="Importadas ativas"
              value={String(importedQuestions.length)}
            />
            <MetricInline label="Erros" value={String(errors.length)} />
            {errors.length > 0 && (
              <Alert className="rounded-md" variant="destructive">
                <CircleAlert className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Corrija antes de importar</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 space-y-1">
                    {errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RecommendationsPanel({
  diagnostics,
  onStartPractice,
}: {
  diagnostics: Diagnostics;
  onStartPractice: (courseId: CourseId, topicId: string) => void;
}) {
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle>Próximas recomendações</CardTitle>
        <CardDescription>
          Calculadas com base nas tentativas salvas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {diagnostics.recommendations.map((recommendation) => (
          <RecommendationItem
            key={recommendation.id}
            onStartPractice={onStartPractice}
            recommendation={recommendation}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function RecommendationItem({
  onStartPractice,
  recommendation,
}: {
  onStartPractice: (courseId: CourseId, topicId: string) => void;
  recommendation: Recommendation;
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-center gap-2">
        <Badge
          className="rounded-md"
          variant={
            recommendation.priority === "alta" ? "destructive" : "secondary"
          }
        >
          {recommendation.priority}
        </Badge>
        <p className="font-medium">{recommendation.title}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {recommendation.description}
      </p>
      <Button
        className="mt-4 w-full"
        onClick={() =>
          onStartPractice(recommendation.courseId, recommendation.topicId)
        }
        size="sm"
        variant="secondary"
      >
        {recommendation.actionLabel}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

function WeakTopicsPanel({
  diagnostics,
  onStartPractice,
}: {
  diagnostics: Diagnostics;
  onStartPractice: (courseId: CourseId, topicId: string) => void;
}) {
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle>Onde melhorar</CardTitle>
        <CardDescription>
          Tópicos abaixo de 70% ou com erros recentes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {diagnostics.weakTopics.length === 0 && (
          <EmptyState
            description="Continue resolvendo questões para gerar sinais confiáveis."
            icon={CheckCircle2}
            title="Nenhum tópico fraco ainda"
          />
        )}
        {diagnostics.weakTopics.slice(0, 5).map((stat) => (
          <div
            className="rounded-md border border-border p-4"
            key={stat.topicId}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{getTopic(stat.topicId)?.title}</p>
                <p className="text-sm text-muted-foreground">
                  {getCourse(stat.courseId)?.title}
                </p>
              </div>
              <Badge variant="destructive">{percent(stat.accuracy)}</Badge>
            </div>
            <Progress className="mt-4" value={stat.accuracy * 100} />
            <Button
              className="mt-4 w-full"
              onClick={() => onStartPractice(stat.courseId, stat.topicId)}
              size="sm"
              variant="secondary"
            >
              Refazer questões
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RecentMistakesPanel({
  attempts,
  onStartPractice,
}: {
  attempts: Attempt[];
  onStartPractice: (courseId: CourseId, topicId: string) => void;
}) {
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle>Erros recentes</CardTitle>
        <CardDescription>Seus erros reais.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {attempts.length === 0 && (
          <EmptyState
            description="Quando você errar, a questão aparecerá aqui."
            icon={CheckCircle2}
            title="Sem erros recentes"
          />
        )}
        {attempts.map((attempt) => (
          <div className="rounded-md border border-border p-4" key={attempt.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{attempt.errorType}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getCourse(attempt.courseId)?.title} /{" "}
                  {getTopic(attempt.topicId)?.title}
                </p>
              </div>
              <Badge className="rounded-md" variant="outline">
                {new Date(attempt.createdAt).toLocaleDateString("pt-BR")}
              </Badge>
            </div>
            <Button
              className="mt-4 w-full"
              onClick={() => onStartPractice(attempt.courseId, attempt.topicId)}
              size="sm"
              variant="secondary"
            >
              Corrigir agora
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: typeof Target;
  label: string;
  tone: string;
  value: string;
}) {
  return (
    <Card className="rounded-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
          <div className={cn("rounded-md bg-muted p-2", tone)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function MetricInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function ViewHeader({
  description,
  icon: Icon,
  iconSrc,
  title,
}: {
  description: string;
  icon?: typeof Home;
  iconSrc?: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="rounded-md bg-primary p-3 text-primary-foreground">
        {iconSrc ? (
          <IconImage className="h-5 w-5" src={iconSrc} />
        ) : Icon ? (
          <Icon className="h-5 w-5" aria-hidden="true" />
        ) : null}
      </div>
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof ClipboardList;
  title: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-border p-6 text-center">
      <Icon
        className="mx-auto h-7 w-7 text-muted-foreground"
        aria-hidden="true"
      />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function practiceAttemptRowToAttempt(row: PracticeAttemptRow): Attempt {
  return {
    id: row.id,
    questionId: row.question_id,
    courseId: row.course_id,
    topicId: row.topic_id,
    prerequisiteIds: row.prerequisite_ids ?? [],
    selectedOptionId: row.selected_option_id,
    correctOptionId: row.correct_option_id,
    correct: row.correct,
    timeSpentSeconds: row.time_spent_seconds,
    difficulty: row.difficulty,
    errorType: row.error_type,
    createdAt: row.created_at,
    source: "practice",
  };
}

function parseStartOfficialExamResponse(
  value: unknown,
): StartOfficialExamResponse | null {
  if (!isRecord(value) || !Array.isArray(value.questions)) return null;
  const attempt = parseRpcExamAttempt(value.attempt);
  if (!attempt) return null;
  const questions = value.questions.filter(isOfficialExamQuestion);
  return questions.length === attempt.questionCount
    ? { attempt, questions }
    : null;
}

function parseSubmitOfficialExamResponse(
  value: unknown,
): SubmitOfficialExamResponse | null {
  if (!isRecord(value) || !Array.isArray(value.answers)) return null;
  const attempt = parseRpcExamAttempt(value.attempt);
  if (
    !attempt ||
    typeof value.score !== "number" ||
    typeof value.correctCount !== "number"
  ) {
    return null;
  }
  const answers = value.answers.filter(isSubmittedOfficialAnswer);
  return answers.length === attempt.questionCount
    ? { attempt, answers, score: value.score, correctCount: value.correctCount }
    : null;
}

function parseRpcExamAttempt(value: unknown): ExamAttempt | null {
  if (!isRecord(value)) return null;
  const statuses: ExamAttemptStatus[] = [
    "in_progress",
    "submitted",
    "expired",
    "late",
  ];
  if (
    typeof value.id !== "string" ||
    typeof value.assessmentId !== "string" ||
    typeof value.courseId !== "string" ||
    typeof value.topicId !== "string" ||
    !statuses.includes(value.status as ExamAttemptStatus) ||
    typeof value.score !== "number" ||
    typeof value.correctCount !== "number" ||
    typeof value.questionCount !== "number" ||
    typeof value.timeLimitSeconds !== "number" ||
    typeof value.timeSpentSeconds !== "number" ||
    !Array.isArray(value.questionIds) ||
    typeof value.startedAt !== "string" ||
    typeof value.createdAt !== "string"
  )
    return null;
  return value as unknown as ExamAttempt;
}

function isOfficialExamQuestion(value: unknown): value is OfficialExamQuestion {
  return Boolean(
    isRecord(value) &&
      typeof value.id === "string" &&
      typeof value.courseId === "string" &&
      typeof value.topicId === "string" &&
      typeof value.prompt === "string" &&
      Array.isArray(value.options) &&
      value.options.length >= 2 &&
      value.options.every(
        (option) =>
          isRecord(option) &&
          typeof option.id === "string" &&
          typeof option.text === "string",
      ),
  );
}

function isSubmittedOfficialAnswer(
  value: unknown,
): value is SubmittedOfficialAnswer {
  return Boolean(
    isRecord(value) &&
      typeof value.questionId === "string" &&
      (typeof value.selectedOptionId === "string" ||
        value.selectedOptionId === null) &&
      typeof value.correctOptionId === "string" &&
      typeof value.correct === "boolean" &&
      typeof value.explanation === "string" &&
      typeof value.errorType === "string" &&
      Array.isArray(value.prerequisiteIds),
  );
}

function responseToExamSession(
  response: StartOfficialExamResponse,
  assessment: OfficialAssessment,
): OfficialExamSession {
  const draft = readExamDraft(response.attempt.id);
  const questionIds = new Set(
    response.questions.map((question) => question.id),
  );
  const selectedAnswers = Object.fromEntries(
    Object.entries(draft?.selectedAnswers ?? {}).filter(
      ([questionId, optionId]) => {
        const question = response.questions.find(
          (item) => item.id === questionId,
        );
        return (
          questionIds.has(questionId) &&
          question?.options.some((option) => option.id === optionId)
        );
      },
    ),
  );
  const timeSpentByQuestion = Object.fromEntries(
    Object.entries(draft?.timeSpentByQuestion ?? {}).filter(
      ([questionId, seconds]) =>
        questionIds.has(questionId) && Number.isFinite(seconds) && seconds >= 0,
    ),
  );
  return {
    attemptId: response.attempt.id,
    assessment,
    questions: response.questions,
    selectedAnswers,
    timeSpentByQuestion,
    startedAt: new Date(response.attempt.startedAt).getTime(),
    timeLimitSeconds: response.attempt.timeLimitSeconds,
  };
}

function upsertExamAttempt(current: ExamAttempt[], incoming: ExamAttempt) {
  return [incoming, ...current.filter((attempt) => attempt.id !== incoming.id)];
}

function saveExamDraft(session: OfficialExamSession) {
  try {
    window.localStorage.setItem(
      `${EXAM_DRAFT_KEY_PREFIX}${session.attemptId}`,
      JSON.stringify({
        selectedAnswers: session.selectedAnswers,
        timeSpentByQuestion: session.timeSpentByQuestion,
      }),
    );
  } catch {
    return;
  }
}

function readExamDraft(attemptId: string) {
  try {
    const value = window.localStorage.getItem(
      `${EXAM_DRAFT_KEY_PREFIX}${attemptId}`,
    );
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (
      !isRecord(parsed) ||
      !isRecord(parsed.selectedAnswers) ||
      !isRecord(parsed.timeSpentByQuestion)
    ) {
      return null;
    }
    return parsed as {
      selectedAnswers: Record<string, string>;
      timeSpentByQuestion: Record<string, number>;
    };
  } catch {
    return null;
  }
}

function clearExamDraft(attemptId: string) {
  try {
    window.localStorage.removeItem(`${EXAM_DRAFT_KEY_PREFIX}${attemptId}`);
  } catch {
    return;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function officialAnswerRowToAttempt(row: OfficialExamAnswerRow): Attempt {
  return {
    id: row.id,
    questionId: row.question_id,
    courseId: row.course_id,
    topicId: row.topic_id,
    prerequisiteIds: row.prerequisite_ids ?? [],
    selectedOptionId: row.selected_option_id ?? "__sem_resposta__",
    correctOptionId: row.correct_option_id,
    correct: row.correct,
    timeSpentSeconds: row.time_spent_seconds,
    difficulty: row.difficulty,
    errorType: row.error_type,
    createdAt: row.answered_at,
    source: "official_exam",
  };
}

function rowToExamAttempt(row: OfficialExamAttemptRow): ExamAttempt {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    courseId: row.course_id,
    topicId: row.topic_id,
    status: row.status,
    score: row.score,
    correctCount: row.correct_count,
    questionCount: row.question_count,
    questionIds: row.question_ids ?? [],
    timeLimitSeconds: row.time_limit_seconds,
    timeSpentSeconds: row.time_spent_seconds,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
  };
}

function rowToAssessment(row: AssessmentScheduleRow): OfficialAssessment {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    courseId: row.course_id,
    topicId: row.topic_id,
    scope: row.scope,
    questionCount: row.question_count,
    difficultyMix: row.difficulty_mix ?? {},
    minimumScore: row.minimum_score,
    maxAttempts: row.max_attempts,
    availableAt: row.available_at,
    dueAt: row.due_at,
    deadlinePolicy: row.deadline_policy,
    required: row.required,
  };
}

function authUserToStudyUser(authUser: {
  id: string;
  email?: string;
  created_at?: string;
  user_metadata?: { name?: string; full_name?: string };
}): StudyUser {
  const email = authUser.email ?? "";

  return {
    id: authUser.id,
    name:
      authUser.user_metadata?.name ??
      authUser.user_metadata?.full_name ??
      email,
    email,
    role: "student",
    createdAt: authUser.created_at ?? new Date().toISOString(),
  };
}

function rememberProfile(user: StudyUser | null) {
  try {
    if (!user) {
      window.localStorage.removeItem(REMEMBERED_PROFILE_KEY);
      return;
    }

    window.localStorage.setItem(
      REMEMBERED_PROFILE_KEY,
      JSON.stringify({
        email: user.email,
        name: user.name,
        rememberedAt: new Date().toISOString(),
      }),
    );
  } catch {
    return;
  }
}

function readRememberedProfile(): { email?: string; name?: string } | null {
  try {
    const value = window.localStorage.getItem(REMEMBERED_PROFILE_KEY);
    return value
      ? (JSON.parse(value) as { email?: string; name?: string })
      : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

function formatNotificationDate(dueAt: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dueAt));
}

function formatNotificationStatus(notification: AssessmentNotification) {
  if (notification.daysUntilDue < 0) {
    return "atrasada";
  }

  if (notification.daysUntilDue === 0) {
    return "hoje";
  }

  return `${notification.daysUntilDue}d`;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value: string) {
  return new Date(value).toISOString();
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function resolveInitialRoute(route?: {
  view?: string;
  course?: string;
  topic?: string;
}) {
  const view = navItems.some((item) => item.id === route?.view)
    ? (route?.view as ViewId)
    : "dashboard";
  const courseId =
    courses.find((course) => course.id === route?.course)?.id ?? "calculo-1";
  const courseTopics = getTopicsByCourse(courseId);
  const topicId = courseTopics.some((topic) => topic.id === route?.topic)
    ? route!.topic!
    : (courseTopics[0]?.id ?? "limites");

  return { view, courseId, topicId };
}

function dedupeQuestions(current: Question[], incoming: Question[]) {
  const incomingIds = new Set(incoming.map((question) => question.id));
  return [
    ...current.filter((question) => !incomingIds.has(question.id)),
    ...incoming,
  ];
}
