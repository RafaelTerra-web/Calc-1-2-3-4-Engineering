"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CourseId, courses, questions, studySteps, topics } from "./content";

type Session = {
  email: string;
  accessToken: string;
  expiresAt: number;
};

type View = "dashboard" | "diagnostic";

const SESSION_KEY = "calculo-em-foco-session";
const PROGRESS_KEY = "calculo-em-foco-progress";

function storedSession() {
  const value = window.localStorage.getItem(SESSION_KEY) ?? window.sessionStorage.getItem(SESSION_KEY);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Session;
    if (!parsed.email || !parsed.accessToken || parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function CourseApp() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("rafaelmodiecai@gmail.com");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [activeCourseId, setActiveCourseId] = useState<CourseId>("calculo-1");
  const [selectedTopicId, setSelectedTopicId] = useState("limites");
  const [completed, setCompleted] = useState<string[]>([]);
  const [view, setView] = useState<View>("dashboard");
  const [diagnosticIndex, setDiagnosticIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [diagnosticResults, setDiagnosticResults] = useState<boolean[]>([]);

  useEffect(() => {
    window.queueMicrotask(() => {
      setSession(storedSession());
      try {
        const saved = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "[]");
        if (Array.isArray(saved)) setCompleted(saved.filter((item): item is string => typeof item === "string"));
      } catch {
        window.localStorage.removeItem(PROGRESS_KEY);
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(completed));
  }, [completed, ready]);

  const activeCourse = courses.find((course) => course.id === activeCourseId) ?? courses[1];
  const activeTopics = topics.filter((topic) => topic.courseId === activeCourseId);
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId) ?? activeTopics[0];
  const diagnosticQuestions = questions.filter((question) => question.courseId === activeCourseId);
  const currentQuestion = diagnosticQuestions[diagnosticIndex];
  const totalProgress = Math.round((completed.length / topics.length) * 100);
  const activeCompleted = activeTopics.filter((topic) => completed.includes(topic.id)).length;
  const nextTopic = topics.find((topic) => !completed.includes(topic.id)) ?? topics[0];

  const courseProgress = useMemo(
    () => Object.fromEntries(courses.map((course) => {
      const courseTopics = topics.filter((topic) => topic.courseId === course.id);
      const done = courseTopics.filter((topic) => completed.includes(topic.id)).length;
      return [course.id, Math.round((done / courseTopics.length) * 100)];
    })),
    [completed],
  );

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setSigningIn(true);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      setLoginError("A conexão da plataforma ainda não foi configurada neste ambiente.");
      setSigningIn(false);
      return;
    }

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();
      if (!response.ok || !data.access_token) {
        setLoginError(data.error_description ?? data.msg ?? "E-mail ou senha incorretos.");
        return;
      }

      const nextSession: Session = {
        email: data.user?.email ?? email.trim(),
        accessToken: data.access_token,
        expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000,
      };
      const storage = remember ? window.localStorage : window.sessionStorage;
      storage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setPassword("");
    } catch {
      setLoginError("Não foi possível conectar. Confira sua internet e tente novamente.");
    } finally {
      setSigningIn(false);
    }
  }

  function signOut() {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  function chooseCourse(courseId: CourseId) {
    const courseTopics = topics.filter((topic) => topic.courseId === courseId);
    const incomplete = courseTopics.find((topic) => !completed.includes(topic.id));
    setActiveCourseId(courseId);
    setSelectedTopicId(incomplete?.id ?? courseTopics[0].id);
    setView("dashboard");
  }

  function chooseTopic(topicId: string) {
    setSelectedTopicId(topicId);
    document.getElementById("estudo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleTopic(topicId: string) {
    setCompleted((current) => current.includes(topicId)
      ? current.filter((id) => id !== topicId)
      : [...current, topicId]);
  }

  function continueCourse() {
    chooseCourse(nextTopic.courseId);
    setSelectedTopicId(nextTopic.id);
    window.setTimeout(() => document.getElementById("estudo")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function startDiagnostic() {
    setView("diagnostic");
    setDiagnosticIndex(0);
    setSelectedAnswer(null);
    setDiagnosticResults([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function nextDiagnosticQuestion() {
    if (selectedAnswer === null || !currentQuestion) return;
    setDiagnosticResults((current) => [...current, selectedAnswer === currentQuestion.correct]);
    setSelectedAnswer(null);
    setDiagnosticIndex((current) => current + 1);
  }

  if (!ready) {
    return <main className="loadingScreen"><span>∫</span><p>Preparando sua trilha…</p></main>;
  }

  if (!session) {
    return (
      <main className="loginShell">
        <section className="loginManifesto">
          <div className="loginBrand"><span>∫</span><b>Cálculo em Foco</b></div>
          <div className="manifestoCopy">
            <p className="eyebrow lightEyebrow">ENGENHARIA · UERJ</p>
            <h1>Aprenda a pensar<br />antes de calcular.</h1>
            <p>Uma trilha de Cálculo I–IV que identifica lacunas, explica decisões e transforma erro em plano de revisão.</p>
          </div>
          <div className="formulaField" aria-hidden="true">
            <span className="formulaA">∂f/∂x</span><span className="formulaB">∫<sub>Ω</sub></span><span className="formulaC">lim<sub>x→a</sub></span>
            <i className="curve curveOne" /><i className="curve curveTwo" />
          </div>
          <div className="manifestoFooter"><span>BASE</span><span>C1</span><span>C2</span><span>C3</span><span>C4</span></div>
        </section>

        <section className="loginPanel">
          <form className="loginForm" onSubmit={signIn}>
            <p className="eyebrow">ÁREA DO ALUNO</p>
            <h2>Continue de onde parou.</h2>
            <p className="loginIntro">Seu diagnóstico e progresso ficam disponíveis neste dispositivo.</p>

            <label>
              <span>E-mail</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </label>
            <label>
              <span>Senha</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </label>
            <label className="rememberRow">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              <span>Manter acesso neste navegador</span>
            </label>
            {loginError && <p className="formError" role="alert">{loginError}</p>}
            <button className="solidButton loginButton" type="submit" disabled={signingIn}>
              {signingIn ? "Entrando…" : "Entrar na plataforma"}<span aria-hidden="true">→</span>
            </button>
            <small>A autenticação é protegida pelo ambiente acadêmico da plataforma.</small>
          </form>
        </section>
      </main>
    );
  }

  if (view === "diagnostic") {
    const finished = diagnosticIndex >= diagnosticQuestions.length;
    const correctCount = diagnosticResults.filter(Boolean).length;
    const score = diagnosticQuestions.length ? Math.round((correctCount / diagnosticQuestions.length) * 100) : 0;
    const missed = diagnosticQuestions.filter((_, index) => diagnosticResults[index] === false);

    return (
      <main className="diagnosticPage">
        <header className="diagnosticHeader">
          <button className="brandButton" type="button" onClick={() => setView("dashboard")}><span>∫</span>Cálculo em Foco</button>
          <div><span>{activeCourse.code}</span><b>Diagnóstico de entrada</b></div>
          <button className="quietButton" type="button" onClick={() => setView("dashboard")}>Sair do diagnóstico</button>
        </header>

        {!diagnosticQuestions.length ? (
          <section className="emptyDiagnostic"><h1>Diagnóstico em preparação.</h1><p>Esta trilha ainda não possui questões diagnósticas.</p><button className="solidButton" onClick={() => setView("dashboard")}>Voltar</button></section>
        ) : finished ? (
          <section className="resultPanel">
            <p className="eyebrow">MAPA DE DOMÍNIO · {activeCourse.code}</p>
            <div className="scoreRing" style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}><span>{score}<small>%</small></span></div>
            <h1>{score >= 70 ? "Base suficiente para avançar." : "Há lacunas que merecem atenção."}</h1>
            <p>{correctCount} de {diagnosticQuestions.length} decisões corretas. O objetivo não é obter uma nota: é escolher o próximo estudo com precisão.</p>
            {missed.length > 0 && (
              <div className="revisionList">
                <span>REVISE PRIMEIRO</span>
                {missed.map((question) => (
                  <button key={question.id} type="button" onClick={() => { setView("dashboard"); setSelectedTopicId(question.topicId); }}>
                    <b>{topics.find((topic) => topic.id === question.topicId)?.title}</b><small>{question.gap}</small><i>→</i>
                  </button>
                ))}
              </div>
            )}
            <div className="resultActions">
              <button className="solidButton" type="button" onClick={() => setView("dashboard")}>Abrir plano recomendado <span>→</span></button>
              <button className="textButton" type="button" onClick={startDiagnostic}>Refazer diagnóstico</button>
            </div>
          </section>
        ) : (
          <section className="questionPanel">
            <div className="questionProgress">
              <span>QUESTÃO {String(diagnosticIndex + 1).padStart(2, "0")} / {String(diagnosticQuestions.length).padStart(2, "0")}</span>
              <div><i style={{ width: `${(diagnosticIndex / diagnosticQuestions.length) * 100}%` }} /></div>
              <b>{currentQuestion.difficulty}</b>
            </div>
            <p className="questionTopic">{topics.find((topic) => topic.id === currentQuestion.topicId)?.title}</p>
            <h1>{currentQuestion.prompt}</h1>
            <div className="answerGrid">
              {currentQuestion.options.map((option, index) => {
                const answered = selectedAnswer !== null;
                const isCorrect = index === currentQuestion.correct;
                const isSelected = selectedAnswer === index;
                return (
                  <button
                    key={option}
                    type="button"
                    className={`${isSelected ? "selected" : ""} ${answered && isCorrect ? "correct" : ""} ${answered && isSelected && !isCorrect ? "incorrect" : ""}`}
                    onClick={() => selectedAnswer === null && setSelectedAnswer(index)}
                  >
                    <span>{String.fromCharCode(65 + index)}</span><b>{option}</b>
                  </button>
                );
              })}
            </div>
            {selectedAnswer !== null && (
              <div className={`answerFeedback ${selectedAnswer === currentQuestion.correct ? "success" : "review"}`}>
                <span>{selectedAnswer === currentQuestion.correct ? "RACIOCÍNIO CORRETO" : "PONTO DE REVISÃO"}</span>
                <p>{currentQuestion.explanation}</p>
              </div>
            )}
            <button className="solidButton nextQuestion" type="button" disabled={selectedAnswer === null} onClick={nextDiagnosticQuestion}>
              {diagnosticIndex === diagnosticQuestions.length - 1 ? "Ver meu diagnóstico" : "Próxima questão"}<span>→</span>
            </button>
          </section>
        )}
      </main>
    );
  }

  return (
    <main className="appShell">
      <header className="appHeader">
        <a className="appBrand" href="#inicio"><span>∫</span><div><b>Cálculo em Foco</b><small>ENGENHARIA · UERJ</small></div></a>
        <nav aria-label="Navegação principal"><a href="#trilha">Trilha</a><a href="#estudo">Estudo atual</a><button type="button" onClick={startDiagnostic}>Diagnóstico</button></nav>
        <div className="userMenu"><span>{session.email.split("@")[0]}</span><button type="button" onClick={signOut}>Sair</button></div>
      </header>

      <section className="courseRail" aria-label="Escolher trilha">
        {courses.map((course) => (
          <button key={course.id} type="button" className={course.id === activeCourseId ? "active" : ""} onClick={() => chooseCourse(course.id)}>
            <span>{course.code}</span><b>{course.title}</b><i><em style={{ width: `${courseProgress[course.id]}%` }} /></i><small>{courseProgress[course.id]}%</small>
          </button>
        ))}
      </section>

      <section className="dashboardHero" id="inicio">
        <div className="heroMain">
          <p className="eyebrow">SEU PRÓXIMO PASSO · {nextTopic.courseId === "pre-calculo" ? "BASE" : courses.find((course) => course.id === nextTopic.courseId)?.code}</p>
          <h1>{nextTopic.title}</h1>
          <p>{nextTopic.description}</p>
          <div className="studyMeta"><span>20 min</span><span>1 conceito</span><span>1 exemplo</span><span>prática guiada</span></div>
          <div className="heroActions"><button className="solidButton" type="button" onClick={continueCourse}>Continuar estudo <span>→</span></button><button className="textButton" type="button" onClick={startDiagnostic}>Refazer diagnóstico</button></div>
        </div>
        <aside className="masteryMap">
          <div className="masteryHeading"><span>MAPA DE DOMÍNIO</span><strong>{totalProgress}%</strong></div>
          <div className="masteryBars">
            {courses.map((course) => <div key={course.id}><span>{course.code}</span><i><em style={{ width: `${courseProgress[course.id]}%`, backgroundColor: course.tone }} /></i><small>{courseProgress[course.id]}%</small></div>)}
          </div>
          <p>{completed.length} de {topics.length} tópicos consolidados neste dispositivo.</p>
        </aside>
      </section>

      <section className="methodStrip">
        {studySteps.map(([number, title, description]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}
      </section>

      <section className="curriculumSection" id="trilha">
        <div className="sectionLead"><p className="eyebrow">TRILHA SELECIONADA · {activeCourse.code}</p><h2>{activeCourse.title}</h2><p>{activeCourse.description}</p></div>
        <div className="curriculumGrid">
          <aside className="courseIdentity" style={{ "--course-tone": activeCourse.tone } as React.CSSProperties}>
            <span>{activeCourse.symbol}</span><p>APLICAÇÃO NA ENGENHARIA</p><h3>{activeCourse.application}</h3><div><b>{activeCompleted}/{activeTopics.length}</b><small>tópicos consolidados</small></div>
          </aside>
          <div className="topicList">
            {activeTopics.map((topic, index) => {
              const done = completed.includes(topic.id);
              const selected = selectedTopic.id === topic.id;
              return (
                <article key={topic.id} className={selected ? "selected" : ""}>
                  <button className="topicOpen" type="button" onClick={() => chooseTopic(topic.id)}>
                    <span>{String(index + 1).padStart(2, "0")}</span><div><h3>{topic.title}</h3><p>{topic.description}</p></div><i>→</i>
                  </button>
                  <button className={done ? "topicStatus done" : "topicStatus"} type="button" onClick={() => toggleTopic(topic.id)} aria-label={`${done ? "Desmarcar" : "Marcar"} ${topic.title} como concluído`} aria-pressed={done}>{done ? "✓" : "○"}</button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="studySection" id="estudo">
        <div className="studyHeader"><div><p className="eyebrow lightEyebrow">ESTUDO ATUAL · {activeCourse.code}</p><h2>{selectedTopic.title}</h2></div><span>{activeTopics.findIndex((topic) => topic.id === selectedTopic.id) + 1}/{activeTopics.length}</span></div>
        <div className="studyGrid">
          <div className="conceptColumn">
            <div className="conceptBlock"><span>01 · IDEIA CENTRAL</span><h3>{selectedTopic.description}</h3><p>Antes da técnica, procure responder: o que varia, o que permanece fixo e qual grandeza o resultado representa?</p></div>
            <div className="outcomeBlock"><span>AO FINAL, VOCÊ DEVE CONSEGUIR</span>{selectedTopic.outcomes.map((outcome) => <p key={outcome}><i>✓</i>{outcome}</p>)}</div>
            <div className="exampleBlock"><span>02 · EXEMPLO DE ENGENHARIA</span><p>{activeCourse.application}</p><small>Traduza o enunciado em grandezas, declare as unidades e só então escolha a ferramenta matemática.</small></div>
          </div>
          <div className="practiceColumn">
            {selectedTopic.videoId ? (
              <div className="videoLesson"><iframe src={`https://www.youtube-nocookie.com/embed/${selectedTopic.videoId}?rel=0`} title={selectedTopic.videoTitle ?? selectedTopic.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /><div><span>AULA DE APOIO</span><b>{selectedTopic.videoTitle}</b><a href={`https://www.youtube.com/watch?v=${selectedTopic.videoId}`} target="_blank" rel="noreferrer">Abrir no YouTube ↗</a></div></div>
            ) : (
              <div className="noVideo"><span>{activeCourse.symbol}</span><h3>Construa o conceito no papel.</h3><p>Escreva a definição, desenhe uma interpretação e resolva um caso simples antes da lista.</p></div>
            )}
            <div className="practicePrompt"><span>03 · RECUPERAÇÃO ATIVA</span><h3>Feche o material e explique este tópico em três frases.</h3><p>Depois, resolva um exemplo sem consultar a solução. Marque como consolidado somente quando conseguir justificar cada passo.</p><button className={completed.includes(selectedTopic.id) ? "completed" : ""} type="button" onClick={() => toggleTopic(selectedTopic.id)}>{completed.includes(selectedTopic.id) ? "✓ Tópico consolidado" : "Marcar como consolidado"}</button></div>
          </div>
        </div>
      </section>

      <section className="diagnosticCta">
        <div><p className="eyebrow lightEyebrow">NÃO SABE POR ONDE RECOMEÇAR?</p><h2>O diagnóstico separa dificuldade de Cálculo de dificuldade de base.</h2></div><button className="outlineButton" type="button" onClick={startDiagnostic}>Diagnosticar {activeCourse.title} <span>→</span></button>
      </section>

      <footer className="appFooter"><div className="appBrand inverse"><span>∫</span><div><b>Cálculo em Foco</b><small>ENGENHARIA · UERJ</small></div></div><p>Entender · Resolver · Verificar · Explicar</p><a href="#inicio">Voltar ao início ↑</a></footer>
    </main>
  );
}
