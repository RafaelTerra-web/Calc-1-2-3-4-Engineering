"use client";

import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Database,
  ExternalLink,
  FileInput,
  GraduationCap,
  Home,
  LineChart,
  ListChecks,
  Loader2,
  LogOut,
  Menu,
  Play,
  RotateCcw,
  SearchCheck,
  Settings,
  Target,
  Timer,
  Upload,
  Video,
  XCircle,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { buildDiagnostics, getQuestionProgress } from "@/lib/analytics";
import {
  buildOfficialExamStats,
  calculateTimeLimitSeconds,
  DEFAULT_DIFFICULTY_TIME_MINUTES,
  DEFAULT_REFERENCE_DATE,
  describeAssessmentScope,
  formatAssessmentWindow,
  getAssessmentStatusLabel,
  officialAssessments as defaultOfficialAssessments,
  selectAssessmentQuestions,
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
import { getVideosForQuestion, videoResources } from "@/lib/videos";
import type {
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
  question_id: string;
  course_id: CourseId;
  topic_id: string;
  prerequisite_ids: string[] | null;
  selected_option_id: string;
  correct_option_id: string;
  correct: boolean;
  time_spent_seconds: number;
  difficulty: "basico" | "medio" | "avancado";
  error_type: string;
  answered_at: string;
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

type ExamSession = {
  attemptId: string;
  assessment: OfficialAssessment;
  questions: Question[];
  selectedAnswers: Record<string, string>;
  startedAt: number;
  timeLimitSeconds: number;
};

const INITIAL_EMAIL = "rafaelmodiecai@gmail.com";
const REMEMBERED_PROFILE_KEY = "calculo-uerj:remembered-profile";
const LEGACY_STORAGE_KEYS = [
  "calculo-uerj:user",
  "calculo-uerj:attempts",
  "calculo-uerj:imported-questions",
];

const navItems: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: "dashboard", label: "Hoje", icon: Home },
  { id: "trilhas", label: "Trilhas", icon: BookOpen },
  { id: "pre-requisitos", label: "Pré-requisitos", icon: Brain },
  { id: "pratica", label: "Prática", icon: ListChecks },
  { id: "provas", label: "Provas", icon: GraduationCap },
  { id: "playlists", label: "Playlists", icon: Video },
  { id: "importacao", label: "Importação", icon: FileInput },
  { id: "admin", label: "Admin", icon: Settings },
];

const importExample = `courseId,topicId,prerequisiteIds,prompt,optionA,optionB,optionC,optionD,correctOptionId,explanation,difficulty,errorType,tags
calculo-1,limites,pre-fatoracao|pre-produtos-notaveis,"Calcule lim_{x -> 1} (x^2 - 1)/(x - 1).",0,1,2,"Não existe",c,"Fatore x^2 - 1 = (x - 1)(x + 1) e substitua x = 1.",basico,"Fatoração em limite","limites|fatoracao"`;

export function StudyPlatform({
  initialUser,
  supabaseConfigured,
}: {
  initialUser: StudyUser | null;
  supabaseConfigured: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<StudyUser | null>(initialUser);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([]);
  const [assessments, setAssessments] = useState<OfficialAssessment[]>(
    defaultOfficialAssessments,
  );
  const [practiceSessionAnswers, setPracticeSessionAnswers] = useState<
    PracticeSessionAnswer[]
  >([]);
  const [practiceSummaries, setPracticeSummaries] = useState<
    PracticeSessionSummary[]
  >([]);
  const [activeExamSession, setActiveExamSession] = useState<ExamSession | null>(
    null,
  );
  const [importedQuestions, setImportedQuestions] = useState<Question[]>([]);
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const [selectedCourseId, setSelectedCourseId] = useState<CourseId>("calculo-1");
  const [selectedTopicId, setSelectedTopicId] = useState("limites");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [loadingData, setLoadingData] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const referenceDate = DEFAULT_REFERENCE_DATE;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user || !supabase) {
      return;
    }

    let cancelled = false;

    async function loadUserData() {
      setLoadingData(true);
      const [
        officialAnswerResult,
        officialAttemptResult,
        assessmentScheduleResult,
        importResult,
      ] = await Promise.all([
        supabase
          .from("official_exam_answers")
          .select(
            "id, question_id, course_id, topic_id, prerequisite_ids, selected_option_id, correct_option_id, correct, time_spent_seconds, difficulty, error_type, answered_at",
          )
          .order("answered_at", { ascending: false }),
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

      if (
        officialAnswerResult.error ||
        officialAttemptResult.error ||
        assessmentScheduleResult.error ||
        importResult.error
      ) {
        setStatusMessage(
          "Não consegui carregar seus dados oficiais do Supabase. Rode migrations/seed e verifique RLS.",
        );
      } else {
        setAttempts(
          ((officialAnswerResult.data ?? []) as OfficialExamAnswerRow[]).map(
            officialAnswerRowToAttempt,
          ),
        );
        setExamAttempts(
          ((officialAttemptResult.data ?? []) as OfficialExamAttemptRow[]).map(
            rowToExamAttempt,
          ),
        );
        setAssessments(
          ((assessmentScheduleResult.data ?? []) as AssessmentScheduleRow[]).length
            ? ((assessmentScheduleResult.data ?? []) as AssessmentScheduleRow[]).map(
                rowToAssessment,
              )
            : defaultOfficialAssessments,
        );
        setImportedQuestions(
          ((importResult.data ?? []) as ImportedQuestionRow[]).map(
            (row) => row.question,
          ),
        );
        setStatusMessage(null);
      }

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

  const diagnostics = useMemo(
    () => buildDiagnostics(allQuestions, attempts),
    [allQuestions, attempts],
  );

  const examStats = useMemo(
    () => buildOfficialExamStats(assessments, examAttempts, referenceDate),
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
        filteredQuestions.find((question) => question.id === activeQuestionId) ??
        filteredQuestions[0] ??
        null
      );
    }

    return filteredQuestions[0] ?? null;
  }, [activeQuestionId, filteredQuestions]);

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
    if (supabase) {
      await supabase.auth.signOut();
    }

    setUser(null);
    setAttempts([]);
    setExamAttempts([]);
    setPracticeSessionAnswers([]);
    setPracticeSummaries([]);
    setActiveExamSession(null);
    setImportedQuestions([]);
    setActiveView("dashboard");
    setStatusMessage(null);
  }

  async function answerQuestion() {
    if (!activeQuestion || !selectedOptionId || feedback || !user) {
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

    const attempt: Attempt = {
      id: createId("attempt"),
      questionId: activeQuestion.id,
      courseId: activeQuestion.courseId,
      topicId: activeQuestion.topicId,
      prerequisiteIds: activeQuestion.prerequisiteIds,
      selectedOptionId,
      correctOptionId: activeQuestion.correctOptionId,
      correct: selectedOptionId === activeQuestion.correctOptionId,
      timeSpentSeconds: Math.max(
        1,
        Math.round((Date.now() - questionStartedAt) / 1000),
      ),
      difficulty: activeQuestion.difficulty,
      errorType: activeQuestion.errorType,
      createdAt: new Date().toISOString(),
    };

    setPracticeSessionAnswers((current) => [
      ...current.filter((answer) => answer.questionId !== activeQuestion.id),
      {
        questionId: activeQuestion.id,
        courseId: activeQuestion.courseId,
        topicId: activeQuestion.topicId,
        selectedOptionId,
        correctOptionId: activeQuestion.correctOptionId,
        correct: attempt.correct,
        errorType: activeQuestion.errorType,
      },
    ]);
    setFeedback({
      correct: attempt.correct,
      correctOptionText: correctOption.text,
      explanation: activeQuestion.explanation,
    });
    setStatusMessage(
      "Treino registrado apenas nesta sessão. Ele não entra no dashboard oficial.",
    );
  }

  function finishPracticeSession() {
    const topicAnswers = practiceSessionAnswers.filter(
      (answer) =>
        answer.courseId === selectedCourseId && answer.topicId === selectedTopicId,
    );

    if (topicAnswers.length === 0) {
      setStatusMessage("Responda pelo menos uma questão antes de finalizar o treino.");
      return;
    }

    const summary: PracticeSessionSummary = {
      id: createId("practice"),
      courseId: selectedCourseId,
      topicId: selectedTopicId,
      total: topicAnswers.length,
      correct: topicAnswers.filter((answer) => answer.correct).length,
      completedAt: new Date().toISOString(),
    };

    setPracticeSummaries((current) => [summary, ...current].slice(0, 12));
    setPracticeSessionAnswers((current) =>
      current.filter(
        (answer) =>
          answer.courseId !== selectedCourseId || answer.topicId !== selectedTopicId,
      ),
    );
    resetQuestionState();
    setStatusMessage(
      "Treino finalizado. Use as correções e vídeos para revisar; sua nota oficial não mudou.",
    );
  }

  async function startExam(assessment: OfficialAssessment) {
    if (!user || !supabase) {
      setStatusMessage("Faça login com Supabase antes de iniciar uma prova.");
      return;
    }

    const previousQuestionIds = new Set(
      examAttempts
        .filter((attempt) => attempt.assessmentId === assessment.id)
        .flatMap((attempt) => attempt.questionIds),
    );
    const examQuestions = selectAssessmentQuestions(
      assessment,
      allQuestions,
      previousQuestionIds,
    );

    if (examQuestions.length === 0) {
      setStatusMessage(
        "Ainda não há questões suficientes para esta prova. Importe ou cadastre questões.",
      );
      return;
    }

    const timeLimitSeconds = calculateTimeLimitSeconds(examQuestions);
    const { data, error } = await supabase
      .from("official_exam_attempts")
      .insert({
        user_id: user.id,
        assessment_id: assessment.id,
        course_id: assessment.courseId,
        topic_id: assessment.topicId,
        status: "in_progress",
        question_count: examQuestions.length,
        question_ids: examQuestions.map((question) => question.id),
        time_limit_seconds: timeLimitSeconds,
      })
      .select(
        "id, assessment_id, course_id, topic_id, status, score, correct_count, question_count, question_ids, time_limit_seconds, time_spent_seconds, started_at, submitted_at, created_at",
      )
      .single();

    if (error || !data) {
      setStatusMessage(`Não consegui iniciar a prova: ${error?.message ?? "erro desconhecido"}`);
      return;
    }

    const attempt = rowToExamAttempt(data as OfficialExamAttemptRow);
    setExamAttempts((current) => [attempt, ...current]);
    setActiveExamSession({
      attemptId: attempt.id,
      assessment,
      questions: examQuestions,
      selectedAnswers: {},
      startedAt: Date.now(),
      timeLimitSeconds,
    });
    setActiveView("provas");
    setStatusMessage(null);
  }

  function selectExamAnswer(questionId: string, optionId: string) {
    setActiveExamSession((current) =>
      current
        ? {
            ...current,
            selectedAnswers: {
              ...current.selectedAnswers,
              [questionId]: optionId,
            },
          }
        : current,
    );
  }

  async function submitExam(forceStatus?: ExamAttemptStatus) {
    if (!activeExamSession || !user || !supabase) {
      return;
    }

    const unanswered = activeExamSession.questions.filter(
      (question) => !activeExamSession.selectedAnswers[question.id],
    );

    if (unanswered.length > 0 && !forceStatus) {
      setStatusMessage("Responda todas as questões antes de entregar a prova.");
      return;
    }

    const now = new Date();
    const timeSpentSeconds = Math.max(
      1,
      Math.round((Date.now() - activeExamSession.startedAt) / 1000),
    );
    const perQuestionTime = Math.max(
      1,
      Math.round(timeSpentSeconds / activeExamSession.questions.length),
    );
    const correctCount = activeExamSession.questions.filter(
      (question) =>
        activeExamSession.selectedAnswers[question.id] === question.correctOptionId,
    ).length;
    const score = Math.round(
      (correctCount / activeExamSession.questions.length) * 100,
    );
    const late = now.getTime() > new Date(activeExamSession.assessment.dueAt).getTime();
    const status: ExamAttemptStatus =
      forceStatus ?? (late ? "late" : "submitted");

    const { error: updateError } = await supabase
      .from("official_exam_attempts")
      .update({
        status,
        score,
        correct_count: correctCount,
        question_count: activeExamSession.questions.length,
        time_spent_seconds: timeSpentSeconds,
        submitted_at: now.toISOString(),
      })
      .eq("id", activeExamSession.attemptId)
      .eq("user_id", user.id);

    if (updateError) {
      setStatusMessage(`Não consegui salvar o resultado: ${updateError.message}`);
      return;
    }

    const answerRows = activeExamSession.questions.map((question) => {
      const selectedOptionId =
        activeExamSession.selectedAnswers[question.id] ?? "__sem_resposta__";

      return {
        attempt_id: activeExamSession.attemptId,
        user_id: user.id,
        question_id: question.id,
        course_id: question.courseId,
        topic_id: question.topicId,
        prerequisite_ids: question.prerequisiteIds,
        selected_option_id: selectedOptionId,
        correct_option_id: question.correctOptionId,
        correct: selectedOptionId === question.correctOptionId,
        time_spent_seconds: perQuestionTime,
        difficulty: question.difficulty,
        error_type: question.errorType,
      };
    });

    const { data: insertedAnswers, error: answerError } = await supabase
      .from("official_exam_answers")
      .insert(answerRows)
      .select(
        "id, question_id, course_id, topic_id, prerequisite_ids, selected_option_id, correct_option_id, correct, time_spent_seconds, difficulty, error_type, answered_at",
      );

    if (answerError) {
      setStatusMessage(`Resultado salvo, mas respostas não foram detalhadas: ${answerError.message}`);
      return;
    }

    setExamAttempts((current) =>
      current.map((attempt) =>
        attempt.id === activeExamSession.attemptId
          ? {
              ...attempt,
              status,
              score,
              correctCount,
              questionCount: activeExamSession.questions.length,
              timeSpentSeconds,
              submittedAt: now.toISOString(),
            }
          : attempt,
      ),
    );
    setAttempts((current) => [
      ...((insertedAnswers ?? []) as OfficialExamAnswerRow[]).map(
        officialAnswerRowToAttempt,
      ),
      ...current,
    ]);
    setActiveExamSession(null);
    setStatusMessage(
      `Prova entregue: ${score}% (${correctCount}/${activeExamSession.questions.length}).`,
    );
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
          const fallbackRole = nextUser.email === INITIAL_EMAIL ? "admin" : "student";

          const { data: profile } = await supabase
            .from("profiles")
            .upsert({
              id: nextUser.id,
              email: nextUser.email,
              name: nextUser.name,
              role: fallbackRole,
            })
            .select("name, email, role, created_at")
            .single();

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
            diagnostics={diagnostics}
            examStats={examStats}
            user={user}
            onLogout={signOut}
            onNavigate={setActiveView}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <TopBar
            activeView={activeView}
            diagnostics={diagnostics}
            examStats={examStats}
            user={user}
            onLogout={signOut}
            onNavigate={setActiveView}
          />

          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
            {(loadingData || statusMessage) && (
              <Alert className="rounded-md">
                {loadingData ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CircleAlert className="h-4 w-4" aria-hidden="true" />
                )}
                <AlertTitle>{loadingData ? "Carregando dados" : "Status"}</AlertTitle>
                <AlertDescription>
                  {loadingData ? "Sincronizando com Supabase." : statusMessage}
                </AlertDescription>
              </Alert>
            )}

            {activeView === "dashboard" && (
              <DashboardView
                attempts={attempts}
                assessments={assessments}
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
                attempts={attempts}
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
                onCancelSession={() => setActiveExamSession(null)}
                onSelectAnswer={selectExamAnswer}
                onStartExam={startExam}
                onSubmitExam={submitExam}
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
            <AlertDescription>
              `NEXT_PUBLIC_SUPABASE_URL`,
              `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
              `SUPABASE_SERVICE_ROLE_KEY` e `DATABASE_URL` ou
              `POSTGRES_URL_NON_POOLING`.
            </AlertDescription>
          </Alert>
          <p className="text-sm leading-6 text-muted-foreground">
            Depois de provisionar, rode `npx vercel env pull .env.local --yes`
            ou preencha `.env.local` manualmente. A tela de login aparecerá sem
            precisar alterar código.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function SignInScreen({
  onSignIn,
  supabaseConfigured,
}: {
  onSignIn: (input: {
    email: string;
    password: string;
    remember: boolean;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
  supabaseConfigured: boolean;
}) {
  const [email, setEmail] = useState(INITIAL_EMAIL);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const remembered = readRememberedProfile();

      if (remembered?.email) {
        setEmail(remembered.email);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

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

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative flex flex-col justify-between gap-10 overflow-hidden px-6 py-8 sm:px-10 lg:px-14">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <BrandLogo />

        <div className="max-w-2xl space-y-8">
          <div className="space-y-4">
            <Badge className="rounded-md" variant="secondary">
              Supabase Auth + diagnóstico real
            </Badge>
            <h2 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
              Estude Cálculo com diagnóstico, base e prática guiada.
            </h2>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              Suas tentativas, questões importadas e recomendações ficam ligadas
              à sua conta no Supabase, com revisão de pré-requisitos quando o
              erro nasce na base.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <VisualTile
              icon={Target}
              label="Diagnóstico"
              tone="text-rose-300"
              value="para você"
            />
            <VisualTile
              icon={Brain}
              label="Base"
              tone="text-emerald-300"
              value="pré-requisitos"
            />
            <VisualTile
              icon={LineChart}
              label="Persistência"
              tone="text-sky-300"
              value="Supabase"
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Usuário inicial planejado:{" "}
          <span className="font-mono text-foreground">{INITIAL_EMAIL}</span>
        </p>
      </section>

      <section className="flex items-center justify-center border-t border-border bg-card/50 px-6 py-10 lg:border-l lg:border-t-0">
        <Card className="w-full max-w-md rounded-md">
          <CardHeader>
            <CardTitle>Acessar plataforma</CardTitle>
            <CardDescription>
              Use a senha temporária criada pelo script de seed do Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  autoComplete="email"
                  disabled={!supabaseConfigured || pending}
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  autoComplete="current-password"
                  disabled={!supabaseConfigured || pending}
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
                <input
                  checked={remember}
                  className="mt-1 h-4 w-4 accent-primary"
                  disabled={pending}
                  onChange={(event) => setRemember(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  Lembre de mim neste navegador. A senha não será salva no
                  localStorage.
                </span>
              </label>
              {error && (
                <Alert className="rounded-md" variant="destructive">
                  <CircleAlert className="h-4 w-4" aria-hidden="true" />
                  <AlertTitle>Falha no login</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button className="w-full" disabled={pending} type="submit">
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                )}
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Sidebar({
  activeView,
  diagnostics,
  examStats,
  onLogout,
  onNavigate,
  user,
}: {
  activeView: ViewId;
  diagnostics: Diagnostics;
  examStats: OfficialExamStats;
  onLogout: () => void;
  onNavigate: (view: ViewId) => void;
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
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Button>
        ))}
      </nav>

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
            <Badge variant={diagnostics.weakTopics.length ? "destructive" : "secondary"}>
              {diagnostics.weakTopics.length}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="mt-auto flex items-center gap-3 rounded-md border border-border p-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback>{initials(user.name || user.email)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Button aria-label="Sair" onClick={onLogout} size="icon" variant="ghost">
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function TopBar({
  activeView,
  diagnostics,
  examStats,
  onLogout,
  onNavigate,
  user,
}: {
  activeView: ViewId;
  diagnostics: Diagnostics;
  examStats: OfficialExamStats;
  onLogout: () => void;
  onNavigate: (view: ViewId) => void;
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
                diagnostics={diagnostics}
                examStats={examStats}
                onLogout={onLogout}
                onNavigate={onNavigate}
                user={user}
              />
            </SheetContent>
          </Sheet>
          <div>
            <p className="text-sm text-muted-foreground">Área do aluno</p>
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Badge className="rounded-md" variant="secondary">
            {examStats.submittedAttempts.length} provas
          </Badge>
          <Badge className="rounded-md" variant="outline">
            {examStats.averageScore}% média
          </Badge>
        </div>
      </div>
    </header>
  );
}

function DashboardView({
  attempts,
  assessments,
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

  return (
    <div className="space-y-6">
      <ViewHeader
        description="Seu painel separa estudo livre de desempenho oficial. Treinos ajudam a revisar; provas oficiais alimentam notas e diagnóstico."
        icon={Home}
        title="Hoje"
      />

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
                <h2 className="mt-1 text-xl font-semibold">{nextAssessment.title}</h2>
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
          tone="text-emerald-300"
          value={`${examStats.averageScore}%`}
        />
        <MetricCard
          detail={`${examStats.completedAssessments}/${examStats.totalAssessments} avaliações concluídas`}
          icon={Target}
          label="Melhor nota"
          tone="text-sky-300"
          value={`${examStats.bestScore}%`}
        />
        <MetricCard
          detail="Apenas erros de provas oficiais entram aqui"
          icon={CircleAlert}
          label="Pontos fracos"
          tone="text-rose-300"
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
          tone="text-amber-300"
          value={String(practiceSummaries.reduce((total, item) => total + item.total, 0))}
        />
      </div>

      {attempts.length === 0 && (
        <Alert className="rounded-md">
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Nenhuma prova oficial entregue ainda</AlertTitle>
          <AlertDescription>
            Você pode treinar à vontade sem prejudicar o painel. Quando entregar
            uma prova oficial, suas notas, erros e recomendações aparecerão aqui.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-md">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>Progresso oficial por disciplina</CardTitle>
                <CardDescription>
                  Cobertura calculada por provas oficiais e avaliações temáticas.
                </CardDescription>
              </div>
              <Button onClick={() => onNavigate("trilhas")} size="sm" variant="secondary">
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
                <div className="rounded-md border border-border p-4" key={stat.courseId}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={cn("h-3 w-3 rounded-full", course?.accent)} />
                      <div>
                        <p className="font-medium">{course?.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {stat.completedTopics}/{stat.totalTopics} tópicos iniciados
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
                <div className="rounded-md border border-border p-4" key={assessment.id}>
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
                    <span className="font-medium">{assessment.minimumScore}%</span>
                  </div>
                  {latestAttempt ? (
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Sua nota</span>
                      <span className="font-semibold">{latestAttempt.score}%</span>
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
              Exercícios comuns ficam aqui como volume de estudo, sem virar falha oficial.
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
              <div className="rounded-md border border-border p-4" key={summary.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{getTopic(summary.topicId)?.title}</p>
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
        icon={BookOpen}
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
                const progress = getQuestionProgress(questions, attempts, topic.id);

                return (
                  <div className="rounded-md border border-border p-4" key={topic.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{topic.title}</p>
                          {stat?.weak && <Badge variant="destructive">revisar</Badge>}
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
        icon={Brain}
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
                    <CardTitle className="text-lg">{prerequisite.title}</CardTitle>
                    <CardDescription>{prerequisite.description}</CardDescription>
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
                    <Badge className="rounded-md font-mono" key={example} variant="outline">
                      {example}
                    </Badge>
                  ))}
                </div>
                {firstTopic && (
                  <Button
                    className="w-full"
                    onClick={() => onStartPractice(firstTopic.courseId, firstTopic.id)}
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
      answer.courseId === selectedCourseId && answer.topicId === selectedTopicId,
  );
  const topicSessionCorrect = topicSessionAnswers.filter(
    (answer) => answer.correct,
  ).length;

  return (
    <div className="space-y-6">
      <ViewHeader
        description="Escolha uma disciplina e treine sem pressão. Os erros deste treino não entram no dashboard oficial."
        icon={ListChecks}
        title="Prática"
      />
      <Card className="rounded-md">
        <CardContent className="grid gap-4 p-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Disciplina</Label>
            <Select
              value={selectedCourseId}
              onValueChange={(value) => value && onSelectCourse(value as CourseId)}
            >
              <SelectTrigger>
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
            <Label>Tópico</Label>
            <Select
              value={selectedTopicId}
              onValueChange={(value) => value && onSelectTopic(value)}
            >
              <SelectTrigger>
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
              <Badge variant="secondary">
                temporário
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      <Alert className="rounded-md border-emerald-500/30">
        <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
        <AlertTitle>Treino sem impacto oficial</AlertTitle>
        <AlertDescription>
          Use esta área para errar, consultar explicações e revisar vídeos. Só a
          aba Provas salva desempenho no dashboard.
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
          Feedback imediato de treino. Esta resposta não altera suas notas oficiais.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3">
          {question.options.map((option) => {
            const isSelected = selectedOptionId === option.id;
            const isCorrect = feedback && option.id === question.correctOptionId;
            const isWrong =
              feedback && isSelected && option.id !== question.correctOptionId;

            return (
              <button
                className={cn(
                  "flex min-h-14 items-start gap-3 rounded-md border border-border p-4 text-left transition hover:bg-accent",
                  isSelected && "border-primary bg-accent",
                  isCorrect && "border-emerald-500/70 bg-emerald-500/10",
                  isWrong && "border-rose-500/70 bg-rose-500/10",
                )}
                disabled={Boolean(feedback) || pending}
                key={option.id}
                onClick={() => onSelectOption(option.id)}
                type="button"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border font-mono text-sm uppercase">
                  {option.id}
                </span>
                <span className="leading-6">{option.text}</span>
              </button>
            );
          })}
        </div>

        {feedback && (
          <Alert
            className={cn(
              "rounded-md",
              feedback.correct ? "border-emerald-500/40" : "border-rose-500/40",
            )}
          >
            {feedback.correct ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-300" />
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
          <Button disabled={!feedback} onClick={onMoveToNextQuestion} variant="secondary">
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
  onCancelSession,
  onSelectAnswer,
  onStartExam,
  onSubmitExam,
  referenceDate,
}: {
  activeSession: ExamSession | null;
  assessments: OfficialAssessment[];
  attempts: ExamAttempt[];
  onCancelSession: () => void;
  onSelectAnswer: (questionId: string, optionId: string) => void;
  onStartExam: (assessment: OfficialAssessment) => void;
  onSubmitExam: (forceStatus?: ExamAttemptStatus) => Promise<void>;
  referenceDate: string;
}) {
  const examStats = buildOfficialExamStats(assessments, attempts, referenceDate);

  if (activeSession) {
    return (
      <ExamRunner
        session={activeSession}
        onCancelSession={onCancelSession}
        onSelectAnswer={onSelectAnswer}
        onSubmitExam={onSubmitExam}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ViewHeader
        description="Avaliações oficiais com sorteio de questões, tempo calculado por dificuldade e resultado salvo no Supabase."
        icon={GraduationCap}
        title="Provas oficiais"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          detail="Baseada apenas em provas entregues"
          icon={LineChart}
          label="Média oficial"
          tone="text-emerald-300"
          value={`${examStats.averageScore}%`}
        />
        <MetricCard
          detail={`${examStats.completedAssessments}/${examStats.totalAssessments} avaliações`}
          icon={CheckCircle2}
          label="Conclusão"
          tone="text-sky-300"
          value={`${Math.round(
            (examStats.completedAssessments / Math.max(1, examStats.totalAssessments)) *
              100,
          )}%`}
        />
        <MetricCard
          detail="Prazos vencidos ou atrasados"
          icon={CalendarDays}
          label="Pendências"
          tone="text-amber-300"
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
    .filter((attempt) => attempt.status !== "in_progress")
    .sort((left, right) => right.score - left.score)[0];
  const attemptsLeft = Math.max(0, assessment.maxAttempts - assessmentAttempts.length);
  const disabled = status === "expirada" || attemptsLeft === 0;

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
          <Badge className="rounded-md" variant={status === "disponível" ? "secondary" : "outline"}>
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricInline label="Questões" value={String(assessment.questionCount)} />
          <MetricInline label="Nota mínima" value={`${assessment.minimumScore}%`} />
          <MetricInline label="Tentativas" value={`${attemptsLeft}/${assessment.maxAttempts}`} />
        </div>
        <div className="rounded-md border border-border p-3 text-sm">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{describeAssessmentScope(assessment)}</p>
              <p className="mt-1 text-muted-foreground">
                {formatAssessmentWindow(assessment)}
              </p>
            </div>
          </div>
        </div>
        {bestAttempt && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            Melhor resultado: <span className="font-semibold">{bestAttempt.score}%</span>{" "}
            ({bestAttempt.correctCount}/{bestAttempt.questionCount})
          </div>
        )}
        <Button
          className="w-full"
          disabled={disabled}
          onClick={() => onStartExam(assessment)}
        >
          {bestAttempt ? "Refazer prova" : "Iniciar prova"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
}

function ExamRunner({
  session,
  onCancelSession,
  onSelectAnswer,
  onSubmitExam,
}: {
  session: ExamSession;
  onCancelSession: () => void;
  onSelectAnswer: (questionId: string, optionId: string) => void;
  onSubmitExam: (forceStatus?: ExamAttemptStatus) => Promise<void>;
}) {
  const [now, setNow] = useState(session.startedAt);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsedSeconds = Math.max(0, Math.round((now - session.startedAt) / 1000));
  const remainingSeconds = Math.max(0, session.timeLimitSeconds - elapsedSeconds);
  const answeredCount = Object.keys(session.selectedAnswers).length;
  const allAnswered = answeredCount === session.questions.length;
  const expired = remainingSeconds === 0;

  async function handleSubmit(status?: ExamAttemptStatus) {
    setPending(true);
    await onSubmitExam(status);
    setPending(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Prova em andamento</p>
          <h1 className="text-2xl font-semibold">{session.assessment.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {answeredCount}/{session.questions.length} questões respondidas
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="rounded-md" variant={expired ? "destructive" : "secondary"}>
            <Timer className="mr-1 h-4 w-4" aria-hidden="true" />
            {formatDuration(remainingSeconds)}
          </Badge>
          <Button onClick={onCancelSession} variant="outline">
            Sair da prova
          </Button>
          <Button
            disabled={pending || (!allAnswered && !expired)}
            onClick={() => handleSubmit(expired ? "expired" : undefined)}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Entregar prova
          </Button>
        </div>
      </div>

      {expired && (
        <Alert className="rounded-md" variant="destructive">
          <CircleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Tempo esgotado</AlertTitle>
          <AlertDescription>
            Entregue a prova para salvar o resultado com as respostas já marcadas.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {session.questions.map((question, index) => (
          <Card className="rounded-md" key={question.id}>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge className="rounded-md" variant="secondary">
                  Questão {index + 1}
                </Badge>
                <Badge className="rounded-md" variant="outline">
                  {question.difficulty}
                </Badge>
                <Badge className="rounded-md" variant="outline">
                  {getTopic(question.topicId)?.title}
                </Badge>
              </div>
              <CardTitle className="leading-8">{question.prompt}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {question.options.map((option) => {
                const selected = session.selectedAnswers[question.id] === option.id;

                return (
                  <button
                    className={cn(
                      "flex min-h-14 items-start gap-3 rounded-md border border-border p-4 text-left transition hover:bg-accent",
                      selected && "border-primary bg-accent",
                    )}
                    disabled={expired || pending}
                    key={option.id}
                    onClick={() => onSelectAnswer(question.id, option.id)}
                    type="button"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border font-mono text-sm uppercase">
                      {option.id}
                    </span>
                    <span className="leading-6">{option.text}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
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
          icon={Settings}
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
        icon={Settings}
        title="Admin"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          detail="Provas temáticas e agendadas"
          icon={GraduationCap}
          label="Avaliações"
          tone="text-sky-300"
          value={String(assessments.length)}
        />
        <MetricCard
          detail="Base por dificuldade"
          icon={Timer}
          label="Tempo"
          tone="text-amber-300"
          value="2/4/7 min"
        />
        <MetricCard
          detail="Padrão inicial"
          icon={Target}
          label="Nota mínima"
          tone="text-emerald-300"
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
            <Label>Disponível em</Label>
            <Input
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
            <Label>Prazo final</Label>
            <Input
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
            <Label>Questões</Label>
            <Input
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
            <Label>Nota mínima (%)</Label>
            <Input
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
            <Label>Tentativas</Label>
            <Input
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
            <Label>Após o prazo</Label>
            <Select
              value={draft.deadlinePolicy}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  deadlinePolicy: value as OfficialAssessment["deadlinePolicy"],
                }))
              }
            >
              <SelectTrigger>
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
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
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
    icon: typeof Video;
    kind: VideoResource["kind"];
    title: string;
  }> = [
    {
      accent: "border-l-coral/80",
      focus: "Treino guiado",
      icon: Play,
      kind: "practice",
      title: "Prática e resolução",
      description: "Vídeos de exercícios resolvidos conectados às questões do app.",
    },
    {
      accent: "border-l-sky-400/80",
      focus: "Conceito antes da conta",
      icon: BookOpen,
      kind: "theory",
      title: "Teoria e fundamentos",
      description: "Aulas conceituais para entender o assunto antes de praticar.",
    },
    {
      accent: "border-l-emerald-400/80",
      focus: "Base matemática",
      icon: Brain,
      kind: "prerequisite",
      title: "Pré-requisitos para entender",
      description: "Base de álgebra, funções, trigonometria e geometria analítica.",
    },
  ];

  return (
    <div className="space-y-6">
      <ViewHeader
        description="Três playlists internas curadas por questão, com vídeos individuais ordenados por relação direta, atualidade e visualizações."
        icon={Video}
        title="Playlists"
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {groups.map((group) => {
          const videos = getPlaylistVideos(group.kind);
          const featuredVideo = videos[0];
          const Icon = group.icon;
          const totalViews = videos.reduce(
            (total, video) => total + (video.viewCount ?? 0),
            0,
          );
          const relatedQuestionCount = new Set(
            videos.flatMap((video) => video.questionIds ?? []),
          ).size;

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
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {group.focus}
                      </p>
                      <CardTitle className="mt-1 text-lg">{group.title}</CardTitle>
                    </div>
                  </div>
                  <Badge className="rounded-md" variant="secondary">
                    {videos.length} vídeos
                  </Badge>
                </div>
                <CardDescription className="leading-6">
                  {group.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="grid grid-cols-3 gap-2">
                  <PlaylistMetric label="Views" value={formatViews(totalViews)} />
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
                  <p className="text-sm font-semibold">Biblioteca da playlist</p>
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
    .map((questionId) => questions.find((question) => question.id === questionId))
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
              <li className="text-sm leading-6 text-muted-foreground" key={question.id}>
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
        icon={Upload}
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
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
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
            <CardDescription>Resultado da validação e importação.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MetricInline label="Válidas no texto" value={String(previewCount)} />
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
        <CardDescription>Calculadas com base nas tentativas salvas.</CardDescription>
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
          variant={recommendation.priority === "alta" ? "destructive" : "secondary"}
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
        onClick={() => onStartPractice(recommendation.courseId, recommendation.topicId)}
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
        <CardDescription>Tópicos abaixo de 70% ou com erros recentes.</CardDescription>
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
          <div className="rounded-md border border-border p-4" key={stat.topicId}>
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
  title,
}: {
  description: string;
  icon: typeof Home;
  title: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="rounded-md bg-primary p-3 text-primary-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
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

function VisualTile({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof Target;
  label: string;
  tone: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <Icon className={cn("h-5 w-5", tone)} aria-hidden="true" />
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
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
      <Icon className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function officialAnswerRowToAttempt(row: OfficialExamAnswerRow): Attempt {
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
    createdAt: row.answered_at,
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
  const email = authUser.email ?? INITIAL_EMAIL;

  return {
    id: authUser.id,
    name: authUser.user_metadata?.name ?? authUser.user_metadata?.full_name ?? email,
    email,
    role: email === INITIAL_EMAIL ? "admin" : "student",
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
      JSON.stringify({ email: user.email, name: user.name, rememberedAt: new Date().toISOString() }),
    );
  } catch {
    return;
  }
}

function readRememberedProfile(): { email?: string; name?: string } | null {
  try {
    const value = window.localStorage.getItem(REMEMBERED_PROFILE_KEY);
    return value ? (JSON.parse(value) as { email?: string; name?: string }) : null;
  } catch {
    return null;
  }
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dedupeQuestions(current: Question[], incoming: Question[]) {
  const incomingIds = new Set(incoming.map((question) => question.id));
  return [
    ...current.filter((question) => !incomingIds.has(question.id)),
    ...incoming,
  ];
}
