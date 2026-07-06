# Calculo em Foco

MVP de estudos para Engenharia UERJ com Supabase Auth, trilhas de Calculo 1-4, pre-requisitos, questoes de multipla escolha, diagnostico por erro e importacao de questoes.

## Stack

- Next.js App Router
- Supabase Auth + Supabase Postgres
- Drizzle schema para contrato relacional
- shadcn/ui + Tailwind CSS
- Deploy planejado via Vercel conectado ao GitHub

## Ambiente

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
DATABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

No fluxo recomendado, crie o Supabase pelo Vercel Marketplace e depois rode:

```bash
npx vercel env pull .env.local --yes
```

## Banco e seed

A migration SQL principal fica em:

```text
supabase/migrations/20260706170000_init_calculo_uerj.sql
```

Depois de aplicar a migration no Supabase, rode:

```bash
npm run db:seed
```

O seed:

- upserta cursos, topicos, pre-requisitos e questoes autorais iniciais;
- cria ou atualiza o usuario `rafaelmodiecai@gmail.com`;
- imprime uma senha temporaria forte no terminal.

Nao salve a senha temporaria no repositorio. Troque-a depois pelo painel do Supabase ou por fluxo de recuperacao de senha.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://127.0.0.1:3000`.

Se as variaveis Supabase estiverem ausentes, o app mostra uma tela de configuracao em vez de tentar renderizar login mockado.

## Importacao de questoes

A tela `Importacao` aceita JSON ou CSV. CSV minimo:

```csv
courseId,topicId,prerequisiteIds,prompt,optionA,optionB,optionC,optionD,correctOptionId,explanation,difficulty,errorType,tags
calculo-1,limites,pre-fatoracao|pre-produtos-notaveis,"Calcule lim_{x -> 1} (x^2 - 1)/(x - 1).",0,1,2,"Nao existe",c,"Fatore x^2 - 1 = (x - 1)(x + 1) e substitua x = 1.",basico,"Fatoracao em limite","limites|fatoracao"
```

Questoes importadas ficam vinculadas ao usuario autenticado em `imported_questions`.

## Verificacao

```bash
npm run lint
npm run build
```

## Deploy

Fluxo recomendado:

1. Conectar este repositorio ao Vercel.
2. Provisionar Supabase pelo Vercel Marketplace.
3. Garantir que os envs acima existam em Production, Preview e Development.
4. Abrir PR a partir da branch de feature.
5. Validar o preview da Vercel antes do merge.
