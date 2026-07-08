# Plano de evolução da plataforma de estudos

Este plano parte do estado atual do projeto: Next.js App Router, Supabase Auth/Postgres, um componente principal `StudyPlatform`, navegação por `Dashboard`, `Trilhas`, `Pré-requisitos`, `Prática`, `Playlists` e `Importação`, currículo local em `src/lib/curriculum.ts`, vídeos locais em `src/lib/videos.ts` e persistência oficial hoje concentrada em `attempts`.

O objetivo da próxima versão é separar estudo guiado, exercícios sem pressão e provas oficiais. Exercícios comuns devem ajudar no aprendizado imediato, mas não devem contaminar o dashboard de desempenho oficial. Provas oficiais devem virar a fonte principal de nota, evolução e liberação de conteúdo.

## 1. Nova estrutura geral

### Navegação recomendada

- `Hoje`: primeira tela após login, com próximas ações, prova agendada, revisão pendente e curso ativo.
- `Cursos`: visão de Cálculo 1, 2, 3, 4 e Pré-cálculo, cada um dividido em módulos, tópicos e aulas.
- `Aulas`: tela de estudo por aula, com teoria curta, exemplos, vídeos e exercícios de fixação.
- `Exercícios`: prática leve por aula, tópico ou curso, sem impacto oficial no dashboard.
- `Provas`: provas temáticas, simulados e avaliações agendadas, com persistência oficial.
- `Revisão`: repetição espaçada, erros de prova, pré-requisitos fracos e recomendações.
- `Playlists`: biblioteca de apoio, separada por prática, teoria e pré-requisitos.
- `Admin`: configuração de cursos, aulas, questões, provas, regras e datas.

### Arquitetura de conteúdo

```text
Curso
  Módulo
    Tópico
      Aula
        Conteúdo curto
        Exemplos
        Vídeos recomendados
        Exercícios comuns
      Prova temática do tópico
    Prova do módulo
  Prova final do curso
```

Exemplo prático:

```text
Cálculo 1
  Limites e continuidade
    Limites por fatoração
      Aula: diferença de quadrados em limites
      Exercícios: 6 questões leves
      Prova temática: 8 questões oficiais
```

## 2. Fluxo ideal do usuário

1. Login.
2. Tela `Hoje` mostra uma ação principal: continuar aula, revisar pré-requisito, fazer prova disponível ou retomar prova.
3. Usuário entra no curso ativo.
4. Cada aula segue o ciclo: teoria curta, exemplo resolvido, vídeo, exercícios comuns, resumo.
5. Ao completar aulas suficientes de um tópico, o sistema libera uma prova temática.
6. A prova salva resultado oficial no banco.
7. O dashboard atualiza notas, evolução, pontos fracos oficiais e próximos prazos.
8. Se o resultado for baixo, o sistema recomenda revisão e permite nova tentativa conforme regra.
9. Se o resultado for suficiente, o próximo tópico ou módulo é liberado.

## 3. Sistema de aprendizado

### Divisão

- `Course`: Cálculo 1, 2, 3, 4, Pré-cálculo.
- `Module`: agrupamento pedagógico dentro do curso, como "Limites e continuidade".
- `Topic`: unidade avaliada, como "Limites por fatoração".
- `Lesson`: aula específica, pequena e objetiva.
- `LessonResource`: vídeos, exemplos, anotações e links.
- `ExerciseSet`: lista de exercícios comuns ligada a aula/tópico.
- `Assessment`: prova oficial ligada a tópico, módulo, curso ou data.

### Progresso

O progresso deve ser calculado por evidências diferentes:

- Aula vista: peso baixo, apenas indica exposição ao conteúdo.
- Exercícios comuns concluídos: peso médio para progresso de estudo, mas sem nota oficial.
- Revisões feitas: peso médio para retenção.
- Provas oficiais: peso alto e fonte principal de domínio.

Sugestão de progresso do tópico:

```text
progresso_topico =
  20% aulas concluídas +
  20% exercícios comuns finalizados +
  20% revisões concluídas +
  40% melhor prova oficial do tópico
```

### Pronto para avançar

Um usuário fica pronto para avançar quando:

- conclui pelo menos 80% das aulas do tópico;
- finaliza os exercícios comuns obrigatórios;
- tira nota mínima na prova temática, por exemplo 70%;
- não possui pré-requisito crítico abaixo do limiar, por exemplo fatoração abaixo de 60% em prova.

Se não atingir o mínimo:

- nota entre 60% e 69%: liberar avanço com aviso e revisão recomendada;
- nota abaixo de 60%: bloquear avanço do próximo tópico central e recomendar revisão;
- erro concentrado em pré-requisito: sugerir aula base antes de refazer a prova.

## 4. Exercícios comuns

### Regra central

Exercícios comuns são treino. Eles não devem aparecer como falha oficial, não devem alimentar `attempts` oficiais e não devem diminuir nota ou confiança do dashboard.

### Como funcionam

- Podem ser feitos dentro da aula, tópico ou curso.
- Mostram feedback imediato após cada resposta.
- Guardam estado apenas em memória durante a sessão ou em storage local temporário.
- Podem sugerir revisão localmente: "Você errou 2 questões com fatoração, revise produtos notáveis antes de continuar".
- Ao finalizar, mostram resumo de aprendizado, explicações e links de teoria/prática.

### Dados temporários

Os erros podem existir apenas enquanto a sessão está aberta:

```ts
type PracticeSessionState = {
  lessonId?: string;
  topicId: string;
  answers: Array<{
    questionId: string;
    selectedOptionId: string;
    correct: boolean;
    errorType?: string;
  }>;
};
```

Se quiser persistir progresso leve, salve apenas conclusão, não erro oficial:

- `lesson_progress.completed_exercise_sets`;
- `study_activity` com tipo `exercise_completed`;
- sem salvar alternativa errada, nota ou "ponto fraco oficial".

## 5. Provas oficiais

### Tipos

- `topic_exam`: prova obrigatória ao final de tópico.
- `module_exam`: prova ao final de módulo.
- `course_exam`: prova final do curso.
- `scheduled_exam`: prova marcada pelo admin.
- `diagnostic_exam`: prova inicial para mapear nível.

### Fluxo da prova

1. Usuário abre prova disponível.
2. Sistema cria `exam_attempt`.
3. Questões são sorteadas e congeladas em `exam_attempt_questions`.
4. Tempo limite é calculado e salvo no início.
5. Usuário responde questão por questão.
6. Ao finalizar ou expirar, sistema calcula resultado.
7. Resultado oficial aparece no dashboard.

### Dados salvos

Salvar:

- prova;
- tentativa;
- questões sorteadas;
- resposta escolhida;
- acerto/erro;
- tempo por questão;
- nota final;
- temas fracos;
- pré-requisitos afetados;
- status: `in_progress`, `submitted`, `expired`, `late`, `cancelled`.

Não recalcular a prova com banco mutável. A tentativa deve manter snapshot das questões/alternativas para auditoria.

## 6. Provas agendadas pelo Admin

### Configuração

Admin define:

- curso, módulo ou tópico;
- data e horário de abertura;
- prazo final;
- política após prazo: `expira`, `fica atrasada`, `continua disponível`;
- quantidade de questões;
- distribuição por dificuldade;
- nota mínima;
- tentativas permitidas;
- tempo base por dificuldade;
- se libera ou bloqueia próximo conteúdo.

### Estados da prova para o usuário

- `programada`: aparece em "Próximos prazos".
- `disponível`: aparece como ação principal em `Hoje`.
- `em andamento`: pode retomar dentro do tempo.
- `entregue`: resultado disponível.
- `atrasada`: pode fazer com marcação de atraso, se a regra permitir.
- `expirada`: não pode mais iniciar.

### Avisos

- 7 dias antes: "Prova de Limites está chegando".
- 24 horas antes: destaque no dashboard.
- no dia: ação principal.
- após prazo: aviso conforme política.

## 7. Tempo limite inteligente

Use uma fórmula simples e configurável por dificuldade:

```text
tempo_total_minutos =
  soma(tempo_base_por_dificuldade) +
  bonus_contexto +
  arredondamento
```

Valores iniciais:

- básica: 2 minutos;
- média: 4 minutos;
- avançada: 7 minutos.

Bônus:

- +10% para provas com enunciados longos;
- +15% para cálculo vetorial, integrais múltiplas ou EDOs;
- mínimo de 15 minutos por prova;
- máximo configurável, por exemplo 120 minutos.

Exemplo:

```text
5 básicas x 2 = 10
4 médias x 4 = 16
3 avançadas x 7 = 21
subtotal = 47
bônus Cálculo 4 = 7
tempo final = 55 minutos arredondado
```

## 8. Sorteio de questões

### Banco de questões

Cada questão deve ter:

- curso;
- módulo;
- tópico;
- aula opcional;
- dificuldade;
- tipo: conceitual, cálculo direto, aplicação, interpretação gráfica;
- pré-requisitos;
- tags;
- tempo estimado;
- status: rascunho, publicada, arquivada;
- estatísticas agregadas oficiais.

### Sorteio

O admin define uma matriz:

```text
Tema: Limites
Quantidade: 10
Básicas: 4
Médias: 4
Avançadas: 2
Pré-requisitos obrigatórios: fatoração, produtos notáveis
```

Algoritmo:

1. filtrar questões publicadas por curso/tópico;
2. separar por dificuldade;
3. remover questões vistas recentemente em provas oficiais pelo mesmo usuário;
4. priorizar questões menos usadas globalmente;
5. sortear com peso;
6. se faltar questão em uma dificuldade, preencher com dificuldade vizinha e registrar fallback;
7. salvar snapshot no início da tentativa.

Para evitar repetição:

- manter `question_exposure` por usuário;
- reduzir peso de questões usadas nos últimos 30 dias;
- impedir repetição na tentativa seguinte, salvo banco insuficiente;
- alternar tipos de pergunta, não só dificuldade.

## 9. Provas por tema

Ao final de cada tópico importante, criar prova temática obrigatória.

Regras sugeridas:

- liberada quando aulas obrigatórias e exercícios mínimos forem concluídos;
- nota mínima padrão: 70%;
- pode refazer após revisão ou intervalo;
- melhor nota pode contar para progresso, mas histórico deve manter todas as tentativas;
- abaixo de 70% gera plano de revisão;
- acima de 85% pode liberar exercícios avançados ou próximo módulo.

Exemplo:

```text
Tópico: Derivadas
Prova: Regras de derivação e interpretação
Questões: 12
Tempo: calculado pela dificuldade
Resultado:
  nota >= 70: libera Aplicações de Derivadas
  nota 50-69: recomenda revisão e permite refazer
  nota < 50: recomenda voltar para Funções e Limites
```

## 10. Dashboard

### Princípio

O dashboard não deve punir estudo. Ele deve mostrar desempenho oficial e próximos passos úteis.

### Blocos recomendados

- `Hoje`: ação principal e próxima prova.
- `Progresso de estudo`: aulas concluídas, tópicos iniciados e sequência de revisão.
- `Exercícios feitos`: volume de prática, sem erros oficiais.
- `Provas oficiais`: nota média, melhor nota, últimas provas e tentativas.
- `Evolução`: gráfico simples de notas por data.
- `Próximos prazos`: provas agendadas e revisões.
- `Pontos fracos oficiais`: apenas baseados em provas.
- `Recomendações`: próximas aulas, revisão e prova liberada.

### Métricas oficiais

- média ponderada das provas;
- melhor nota por tópico;
- taxa de acerto oficial por tópico;
- tempo médio oficial por questão;
- temas com maior erro em provas;
- evolução nas últimas 5 provas;
- provas atrasadas ou pendentes.

### Métricas não oficiais

Exercícios comuns podem aparecer como atividade:

- exercícios feitos hoje;
- aulas praticadas;
- sequência de estudo;
- tópicos treinados.

Mas não devem aparecer como:

- erro oficial;
- ponto fraco oficial;
- nota;
- queda de desempenho.

## 11. Painel administrativo

### Áreas

- `Cursos`: criar, ordenar e publicar cursos.
- `Módulos`: agrupar tópicos e definir pré-requisitos.
- `Aulas`: texto curto, exemplos, vídeos e exercícios ligados.
- `Questões`: cadastro, dificuldade, tags, alternativas e explicações.
- `Provas`: modelos, distribuição, tempo e nota mínima.
- `Agenda`: datas de abertura, prazo e política após vencimento.
- `Regras`: tentativas, desbloqueios, repetição, tempo por dificuldade.
- `Importação`: CSV/JSON com validação.
- `Relatórios`: desempenho oficial por usuário.

### Permissões

Adicionar papel em `profiles.role`:

- `student`: estuda e faz provas.
- `admin`: gerencia conteúdo e agenda.

RLS:

- alunos leem conteúdo publicado;
- alunos leem apenas seus resultados;
- admin gerencia conteúdo e lê relatórios.

## 12. Banco de dados proposto

### Conteúdo

- `courses`
- `modules`
- `topics`
- `lessons`
- `lesson_resources`
- `prerequisites`
- `topic_prerequisites`
- `questions`
- `question_options`
- `question_prerequisites`
- `question_tags`

### Exercícios comuns

- `exercise_sets`
- `exercise_set_questions`
- `lesson_progress`
- `study_activity`

Não salvar erros de exercícios comuns como desempenho oficial. Se salvar algo, salvar apenas conclusão e volume.

### Provas oficiais

- `assessments`
- `assessment_blueprints`
- `assessment_schedules`
- `assessment_attempts`
- `assessment_attempt_questions`
- `assessment_answers`
- `assessment_results`
- `assessment_topic_results`
- `question_exposure`

### Configurações

- `platform_settings`
- `assessment_rules`
- `difficulty_time_settings`
- `unlock_rules`

### Revisão

- `review_items`
- `review_events`
- `recommendations`

## 13. Plano técnico em etapas

### Etapa 1: separar conceitos no código

- Criar tipos `Lesson`, `Module`, `Assessment`, `AssessmentAttempt`, `PracticeSession`.
- Renomear mentalmente o `attempts` atual para dado oficial legado.
- Alterar analytics para aceitar apenas tentativas oficiais.
- Ajustar textos da `Prática` para deixar claro que exercícios não impactam o dashboard.

### Etapa 2: nova modelagem Supabase

- Criar migration com módulos, aulas, provas, agendas e resultados.
- Adicionar `profiles.role`.
- Criar RLS para admin e aluno.
- Preservar `attempts` atual ou migrar para `assessment_attempts` se fizer sentido.

### Etapa 3: exercícios sem pressão

- Criar fluxo local de `PracticeSession`.
- Feedback imediato sem insert em `attempts`.
- Tela final com resumo, correção e recomendações temporárias.
- Persistir apenas `lesson_progress` e `study_activity`.

### Etapa 4: provas oficiais

- Criar tela `Provas`.
- Criar sorteio por blueprint.
- Congelar questões sorteadas.
- Implementar timer.
- Salvar respostas e resultado oficial.
- Atualizar dashboard para usar provas.

### Etapa 5: dashboard novo

- Trocar cards atuais por:
  - ação de hoje;
  - próxima prova;
  - progresso de estudo;
  - notas oficiais;
  - evolução;
  - pontos fracos oficiais;
  - revisões.
- Remover erros de exercícios comuns do diagnóstico principal.

### Etapa 6: admin

- Criar rota/tela `Admin`.
- CRUD de cursos, módulos, aulas e questões.
- Configuração de provas, agenda e tempo.
- Importação validada.
- Guardar regras de liberação e tentativas.

### Etapa 7: retenção e repetição espaçada

- Gerar `review_items` a partir de provas oficiais.
- Agendar revisão em 1, 3, 7 e 14 dias, ajustando por acerto.
- Mostrar revisão no painel `Hoje`.
- Não misturar revisão com nota oficial, salvo quando virar prova.

## 14. Prioridade recomendada

1. Separar exercícios comuns de provas oficiais.
2. Criar provas oficiais com resultado persistido.
3. Refatorar dashboard para desempenho oficial.
4. Adicionar agendamento e tempo inteligente.
5. Criar painel admin.
6. Implementar repetição espaçada.

Essa ordem reduz risco porque corrige primeiro o principal problema de produto: hoje toda questão respondida vira desempenho oficial. A partir da separação, o usuário pode estudar sem medo e o dashboard passa a refletir avaliações reais.
