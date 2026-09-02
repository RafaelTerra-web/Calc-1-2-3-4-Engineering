"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Loader2,
  Timer,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getTopic } from "@/lib/curriculum";
import type { OfficialAssessment, Question } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type OfficialExamQuestion = Pick<
  Question,
  | "id"
  | "courseId"
  | "topicId"
  | "prerequisiteIds"
  | "prompt"
  | "options"
  | "difficulty"
  | "tags"
>;

export type OfficialExamSession = {
  attemptId: string;
  assessment: OfficialAssessment;
  questions: OfficialExamQuestion[];
  selectedAnswers: Record<string, string>;
  timeSpentByQuestion: Record<string, number>;
  startedAt: number;
  timeLimitSeconds: number;
};

export function OfficialExamRunner({
  pending,
  session,
  onCancelSession,
  onRecordQuestionTime,
  onSelectAnswer,
  onSubmitExam,
}: {
  pending: boolean;
  session: OfficialExamSession;
  onCancelSession: () => void;
  onRecordQuestionTime: (questionId: string, seconds: number) => void;
  onSelectAnswer: (questionId: string, optionId: string) => void;
  onSubmitExam: (finalTiming?: {
    questionId: string;
    seconds: number;
  }) => Promise<boolean>;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const autoSubmitStarted = useRef(false);
  const questionCheckpoint = useRef(0);
  const recordQuestionTime = useRef(onRecordQuestionTime);

  useEffect(() => {
    recordQuestionTime.current = onRecordQuestionTime;
  }, [onRecordQuestionTime]);

  useEffect(() => {
    questionCheckpoint.current = Date.now();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session.attemptId]);

  const activeQuestion = session.questions[activeQuestionIndex];

  useEffect(() => {
    questionCheckpoint.current = Date.now();
    const checkpointTimer = window.setInterval(() => {
      const checkpointNow = Date.now();
      const seconds = Math.max(
        0,
        Math.floor((checkpointNow - questionCheckpoint.current) / 1000),
      );

      if (activeQuestion && seconds > 0) {
        recordQuestionTime.current(activeQuestion.id, seconds);
      }
      questionCheckpoint.current = checkpointNow;
    }, 10_000);

    return () => {
      window.clearInterval(checkpointTimer);
      const seconds = Math.max(
        0,
        Math.floor((Date.now() - questionCheckpoint.current) / 1000),
      );
      if (activeQuestion && seconds > 0) {
        recordQuestionTime.current(activeQuestion.id, seconds);
      }
    };
  }, [activeQuestion]);

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - session.startedAt) / 1000),
  );
  const remainingSeconds = Math.max(
    0,
    session.timeLimitSeconds - elapsedSeconds,
  );
  const answeredCount = Object.keys(session.selectedAnswers).filter((questionId) =>
    session.questions.some((question) => question.id === questionId),
  ).length;
  const allAnswered = answeredCount === session.questions.length;
  const expired = remainingSeconds === 0;
  const timerAnnouncement = (() => {
    if (expired) {
      return "Tempo esgotado. A entrega automática foi iniciada.";
    }

    if (remainingSeconds <= 60) {
      return "Resta menos de um minuto.";
    }

    return `Restam aproximadamente ${Math.ceil(remainingSeconds / 60)} minutos.`;
  })();

  useEffect(() => {
    if (!expired || pending || autoSubmitStarted.current) {
      return;
    }

    autoSubmitStarted.current = true;
    const finalTiming = getFinalTiming(activeQuestion?.id, questionCheckpoint);
    void onSubmitExam(finalTiming);
  }, [activeQuestion?.id, expired, onSubmitExam, pending]);

  function handleExit() {
    const confirmed = window.confirm(
      "Sair desta tela não pausa a prova. O relógio continuará correndo e suas respostas marcadas ficarão salvas neste navegador. Deseja sair?",
    );

    if (confirmed) {
      onCancelSession();
    }
  }

  function goToQuestion(index: number) {
    if (index < 0 || index >= session.questions.length || index === activeQuestionIndex) {
      return;
    }

    const timing = getFinalTiming(activeQuestion?.id, questionCheckpoint);
    if (timing) {
      onRecordQuestionTime(timing.questionId, timing.seconds);
    }
    setActiveQuestionIndex(index);
  }

  function handleSubmit() {
    const finalTiming = getFinalTiming(activeQuestion?.id, questionCheckpoint);
    void onSubmitExam(finalTiming);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Prova oficial em andamento</p>
          <h1 className="text-2xl font-semibold">{session.assessment.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground" role="status">
            {answeredCount}/{session.questions.length} questões respondidas
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            aria-label={`Tempo restante: ${formatDuration(remainingSeconds)}`}
            className="min-h-11 rounded-md px-3"
            variant={expired ? "destructive" : "secondary"}
          >
            <Timer className="mr-1 h-4 w-4" aria-hidden="true" />
            <span aria-hidden="true">{formatDuration(remainingSeconds)}</span>
          </Badge>
          <span aria-live="polite" className="sr-only">
            {timerAnnouncement}
          </span>
          <Button disabled={pending} onClick={handleExit} variant="outline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Sair da prova
          </Button>
          <Button
            disabled={pending || (!allAnswered && !expired)}
            onClick={handleSubmit}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
            {pending
              ? "Entregando…"
              : expired
                ? "Tentar entrega agora"
                : "Entregar prova"}
          </Button>
        </div>
      </div>

      {expired && (
        <Alert className="rounded-md" variant="destructive" role="alert">
          <CircleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Tempo esgotado</AlertTitle>
          <AlertDescription>
            A plataforma está entregando automaticamente as respostas já
            marcadas. Se a conexão falhar, use o botão para tentar novamente.
          </AlertDescription>
        </Alert>
      )}

      <nav
        aria-label="Questões da prova"
        className="flex flex-wrap gap-2"
      >
        {session.questions.map((question, index) => {
          const answered = Boolean(session.selectedAnswers[question.id]);
          const active = index === activeQuestionIndex;

          return (
            <Button
              aria-current={active ? "step" : undefined}
              aria-label={`Questão ${index + 1}${answered ? ", respondida" : ", sem resposta"}`}
              className="min-h-11 min-w-11"
              key={question.id}
              onClick={() => goToQuestion(index)}
              size="sm"
              type="button"
              variant={active ? "default" : answered ? "secondary" : "outline"}
            >
              {index + 1}
              {answered && <span className="sr-only">Respondida</span>}
            </Button>
          );
        })}
      </nav>

      {activeQuestion && (
        <Card className="rounded-md" key={activeQuestion.id}>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge className="rounded-md" variant="secondary">
                  Questão {activeQuestionIndex + 1} de {session.questions.length}
                </Badge>
                <Badge className="rounded-md" variant="outline">
                  {activeQuestion.difficulty}
                </Badge>
                <Badge className="rounded-md" variant="outline">
                  {getTopic(activeQuestion.topicId)?.title}
                </Badge>
              </div>
              <CardTitle className="leading-8">{activeQuestion.prompt}</CardTitle>
            </CardHeader>
            <CardContent>
              <fieldset
                className="grid gap-3"
                disabled={expired || pending}
              >
                <legend className="sr-only">
                  Resposta da questão {activeQuestionIndex + 1}
                </legend>
                {activeQuestion.options.map((option) => {
                  const selected =
                    session.selectedAnswers[activeQuestion.id] === option.id;
                  const inputId = `official-${activeQuestionIndex}-${option.id}`;

                  return (
                    <label
                      className={cn(
                        "flex min-h-14 cursor-pointer items-start gap-3 rounded-md border border-border p-4 text-left transition hover:bg-accent",
                        "has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2",
                        selected && "border-primary bg-accent",
                        (expired || pending) && "cursor-not-allowed opacity-70",
                      )}
                      htmlFor={inputId}
                      key={option.id}
                    >
                      <input
                        checked={selected}
                        className="mt-1 h-5 w-5 shrink-0 accent-primary"
                        id={inputId}
                        name={`official-question-${activeQuestionIndex}`}
                        onChange={() =>
                          onSelectAnswer(activeQuestion.id, option.id)
                        }
                        type="radio"
                        value={option.id}
                      />
                      <span className="leading-6">
                        <span className="mr-2 font-mono font-medium uppercase">
                          {option.id}.
                        </span>
                        {option.text}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between">
                <Button
                  disabled={activeQuestionIndex === 0 || pending}
                  onClick={() => goToQuestion(activeQuestionIndex - 1)}
                  type="button"
                  variant="outline"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Anterior
                </Button>
                <Button
                  disabled={
                    activeQuestionIndex === session.questions.length - 1 || pending
                  }
                  onClick={() => goToQuestion(activeQuestionIndex + 1)}
                  type="button"
                  variant="secondary"
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </CardContent>
          </Card>
      )}
    </div>
  );
}

function getFinalTiming(
  questionId: string | undefined,
  checkpoint: { current: number },
) {
  if (!questionId) {
    return undefined;
  }

  const now = Date.now();
  const seconds = Math.max(0, Math.floor((now - checkpoint.current) / 1000));
  checkpoint.current = now;
  return { questionId, seconds };
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
