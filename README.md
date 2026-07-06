# Cálculo em Foco

MVP de estudos para Engenharia UERJ com Supabase Auth, trilhas de Cálculo 1-4, pré-requisitos, questões de múltipla escolha, diagnóstico por erro e importação de questões.

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
SUPABASE_SERVICE_ROLE_KEY=

# Criadas automaticamente pelo Vercel Marketplace:
POSTGRES_URL_NON_POOLING=
POSTGRES_PRISMA_URL=
POSTGRES_URL=

# Alternativa opcional se você quiser padronizar em uma URL:
DATABASE_URL=
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

Para aplicar a migration no Supabase e popular o conteúdo inicial, rode:

```bash
npm run db:migrate
npm run db:seed
```

O seed:

- upserta cursos, tópicos, pré-requisitos e questões autorais iniciais;
- cria ou atualiza o usuário `rafaelmodiecai@gmail.com`;
- imprime uma senha temporária forte no terminal.

Não salve a senha temporária no repositório. Troque-a depois pelo painel do Supabase ou por fluxo de recuperação de senha.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://127.0.0.1:3000`.

Se as variáveis Supabase estiverem ausentes, o app mostra uma tela de configuração em vez de tentar renderizar login mockado.

## Importação de questões

A tela `Importação` aceita JSON ou CSV. CSV mínimo:

```csv
courseId,topicId,prerequisiteIds,prompt,optionA,optionB,optionC,optionD,correctOptionId,explanation,difficulty,errorType,tags
calculo-1,limites,pre-fatoracao|pre-produtos-notaveis,"Calcule lim_{x -> 1} (x^2 - 1)/(x - 1).",0,1,2,"Não existe",c,"Fatore x^2 - 1 = (x - 1)(x + 1) e substitua x = 1.",basico,"Fatoração em limite","limites|fatoracao"
```

Questões importadas ficam vinculadas à sua conta em `imported_questions`.

## Verificação

```bash
npm run lint
npm run build
```

## Deploy

Fluxo recomendado:

1. Conectar este repositório ao Vercel.
2. Provisionar Supabase pelo Vercel Marketplace.
3. Garantir que os envs acima existam em Production, Preview e Development.
4. Abrir PR a partir da branch de feature.
5. Validar o preview da Vercel antes do merge.
