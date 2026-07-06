"use client";

import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Database,
  ExternalLink,
  FileInput,
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
  Upload,
  Video,
  XCircle,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { buildDiagnostics, getQuestionProgress } from "@/lib/analytics";
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
import { getVideosForQuestion } from "@/lib/videos";
import type {
  Attempt,
  CourseId,
  Diagnostics,
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

type ViewId = "dashboard" | "trilhas" | "pre-requisitos" | "pratica" | "importacao";

type Feedback = {
  correct: boolean;
  correctOptionText: string;
  explanation: string;
};

type AttemptRow = {
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
  created_at: string;
};

type ImportedQuestionRow = {
  id: string;
  question: Question;
};

const INITIAL_EMAIL = "rafaelmodiecai@gmail.com";
const REMEMBERED_PROFILE_KEY = "calculo-uerj:remembered-profile";
const LEGACY_STORAGE_KEYS = [
  "calculo-uerj:user",
  "calculo-uerj:attempts",
  "calculo-uerj:imported-questions",
];

const navItems: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "trilhas", label: "Trilhas", icon: BookOpen },
  { id: "pre-requisitos", label: "Pré-requisitos", icon: Brain },
  { id: "pratica", label: "Prática", icon: ListChecks },
  { id: "importacao", label: "Importação", icon: FileInput },
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
      const [attemptResult, importResult] = await Promise.all([
        supabase
          .from("attempts")
          .select(
            "id, question_id, course_id, topic_id, prerequisite_ids, selected_option_id, correct_option_id, correct, time_spent_seconds, difficulty, error_type, created_at",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("imported_questions")
          .select("id, question")
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) {
        return;
      }

      if (attemptResult.error || importResult.error) {
        setStatusMessage(
          "Não consegui carregar seus dados do Supabase. Verifique migrations/RLS.",
        );
      } else {
        setAttempts((attemptResult.data ?? []).map(rowToAttempt));
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

    if (!supabase) {
      setStatusMessage("Supabase não está configurado. A tentativa não foi salva.");
      return;
    }

    const { data, error } = await supabase
      .from("attempts")
      .insert({
        user_id: user.id,
        question_id: attempt.questionId,
        course_id: attempt.courseId,
        topic_id: attempt.topicId,
        prerequisite_ids: attempt.prerequisiteIds,
        selected_option_id: attempt.selectedOptionId,
        correct_option_id: attempt.correctOptionId,
        correct: attempt.correct,
        time_spent_seconds: attempt.timeSpentSeconds,
        difficulty: attempt.difficulty,
        error_type: attempt.errorType,
      })
      .select(
        "id, question_id, course_id, topic_id, prerequisite_ids, selected_option_id, correct_option_id, correct, time_spent_seconds, difficulty, error_type, created_at",
      )
      .single();

    if (error) {
      setStatusMessage(`Não consegui salvar a tentativa: ${error.message}`);
      return;
    }

    setAttempts((current) => [rowToAttempt(data as AttemptRow), ...current]);
    setFeedback({
      correct: attempt.correct,
      correctOptionText: correctOption.text,
      explanation: activeQuestion.explanation,
    });
    setStatusMessage(null);
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
    setStatusMessage("Questoes importadas removidas.");
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

          await supabase.from("profiles").upsert({
            id: nextUser.id,
            email: nextUser.email,
            name: nextUser.name,
          });

          rememberProfile(remember ? nextUser : null);
          setUser(nextUser);
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
            user={user}
            onLogout={signOut}
            onNavigate={setActiveView}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <TopBar
            activeView={activeView}
            diagnostics={diagnostics}
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
                diagnostics={diagnostics}
                onNavigate={setActiveView}
                onStartPractice={startPractice}
                questions={allQuestions}
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
                diagnostics={diagnostics}
                feedback={feedback}
                filteredQuestions={filteredQuestions}
                onAnswerQuestion={answerQuestion}
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
              />
            )}

            {activeView === "importacao" && (
              <ImportView
                importedQuestions={importedQuestions}
                onImport={importQuestions}
                onResetImported={resetImportedQuestions}
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
            <AlertTitle>Variaveis obrigatorias</AlertTitle>
            <AlertDescription>
              `NEXT_PUBLIC_SUPABASE_URL`,
              `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
              `SUPABASE_SERVICE_ROLE_KEY` e `DATABASE_URL` ou
              `POSTGRES_URL_NON_POOLING`.
            </AlertDescription>
          </Alert>
          <p className="text-sm leading-6 text-muted-foreground">
            Depois de provisionar, rode `npx vercel env pull .env.local --yes`
            ou preencha `.env.local` manualmente. A tela de login aparecera sem
            precisar alterar codigo.
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
              ao seu usuário no Supabase, com revisão de pré-requisitos quando o
              erro nasce na base.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <VisualTile
              icon={Target}
              label="Diagnóstico"
              tone="text-rose-300"
              value="por usuário"
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
  onLogout,
  onNavigate,
  user,
}: {
  activeView: ViewId;
  diagnostics: Diagnostics;
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
          <CardTitle className="text-base">Saúde do estudo</CardTitle>
          <CardDescription>
            {diagnostics.totalAttempts} tentativas registradas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={diagnostics.accuracy * 100} />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Acerto geral</span>
            <span className="font-medium">{percent(diagnostics.accuracy)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tópicos fracos</span>
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
  onLogout,
  onNavigate,
  user,
}: {
  activeView: ViewId;
  diagnostics: Diagnostics;
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
            {diagnostics.totalAttempts} tentativas
          </Badge>
          <Badge className="rounded-md" variant="outline">
            {percent(diagnostics.accuracy)} geral
          </Badge>
        </div>
      </div>
    </header>
  );
}

function DashboardView({
  attempts,
  diagnostics,
  onNavigate,
  onStartPractice,
  questions,
}: {
  attempts: Attempt[];
  diagnostics: Diagnostics;
  onNavigate: (view: ViewId) => void;
  onStartPractice: (courseId: CourseId, topicId: string) => void;
  questions: Question[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={`${diagnostics.totalCorrect}/${diagnostics.totalAttempts} respostas corretas`}
          icon={Target}
          label="Acerto geral"
          tone="text-emerald-300"
          value={percent(diagnostics.accuracy)}
        />
        <MetricCard
          detail="Abaixo de 70% ou 3 erros recentes"
          icon={CircleAlert}
          label="Tópicos fracos"
          tone="text-rose-300"
          value={String(diagnostics.weakTopics.length)}
        />
        <MetricCard
          detail="Por questão respondida"
          icon={LineChart}
          label="Tempo médio"
          tone="text-amber-300"
          value={`${diagnostics.averageTimeSeconds}s`}
        />
        <MetricCard
          detail="Conteúdo base + importadas"
          icon={Database}
          label="Banco ativo"
          tone="text-sky-300"
          value={String(questions.length)}
        />
      </div>

      {attempts.length === 0 && (
        <Alert className="rounded-md">
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Nenhuma tentativa ainda</AlertTitle>
          <AlertDescription>
            O dashboard começa vazio para usuários novos. Resolva questões para
            gerar diagnóstico real por tópico e pré-requisito.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-md">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>Progresso por disciplina</CardTitle>
                <CardDescription>
                  Cobertura de tópicos e taxa de acerto no seu usuário.
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

      <div className="grid gap-6 xl:grid-cols-2">
        <WeakTopicsPanel
          diagnostics={diagnostics}
          onStartPractice={onStartPractice}
        />
        <RecentMistakesPanel
          attempts={diagnostics.recentMistakes}
          onStartPractice={onStartPractice}
        />
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
  diagnostics,
  feedback,
  filteredQuestions,
  onAnswerQuestion,
  onMoveToNextQuestion,
  onSelectCourse,
  onSelectOption,
  onSelectQuestion,
  onSelectTopic,
  selectedCourseId,
  selectedOptionId,
  selectedTopicId,
}: {
  activeQuestion: Question | null;
  diagnostics: Diagnostics;
  feedback: Feedback | null;
  filteredQuestions: Question[];
  onAnswerQuestion: () => Promise<void>;
  onMoveToNextQuestion: () => void;
  onSelectCourse: (courseId: CourseId) => void;
  onSelectOption: (optionId: string) => void;
  onSelectQuestion: (questionId: string) => void;
  onSelectTopic: (topicId: string) => void;
  selectedCourseId: CourseId;
  selectedOptionId: string | null;
  selectedTopicId: string;
}) {
  const selectedTopic = getTopic(selectedTopicId);
  const topicStat = diagnostics.topicStats.find(
    (stat) => stat.topicId === selectedTopicId,
  );

  return (
    <div className="space-y-6">
      <ViewHeader
        description="Escolha uma disciplina e resolva questões com feedback e persistência."
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
            <p className="text-sm text-muted-foreground">Status do tópico</p>
            <div className="mt-1 flex items-center justify-between">
              <p className="font-medium">
                {topicStat?.attempts ? percent(topicStat.accuracy) : "sem dados"}
              </p>
              <Badge variant={topicStat?.weak ? "destructive" : "secondary"}>
                {topicStat?.weak ? "revisar" : "em andamento"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
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
          O feedback salva a tentativa no Supabase antes de atualizar o painel.
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
            Confirmar resposta
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
            Curadoria em português para resolver, entender e revisar a base antes
            de avançar.
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
        description="Cole CSV ou JSON para expandir o banco do seu usuário."
        icon={Upload}
        title="Importação de questões"
      />
      <div className="grid gap-6 xl:grid-cols-[0.65fr_0.35fr]">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>Entrada CSV/JSON</CardTitle>
            <CardDescription>
              As questões importadas ficam vinculadas ao usuário autenticado.
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
        <CardDescription>Erros reais do usuário autenticado.</CardDescription>
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

function rowToAttempt(row: AttemptRow): Attempt {
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
