import type { Question, QuestionVideos, VideoKind, VideoResource } from "@/lib/types";

const calculusOneTopics = [
  "limites",
  "continuidade",
  "derivadas",
  "aplicacoes-derivadas",
  "integrais",
];

const calculusTwoTopics = [
  "tecnicas-integracao",
  "integrais-improprias",
  "sequencias-series",
  "series-potencias",
];

const calculusThreeTopics = [
  "vetores",
  "funcoes-varias",
  "derivadas-parciais",
  "integrais-multiplas",
];

const calculusFourTopics = [
  "campos-vetoriais",
  "integrais-linha",
  "superficies",
  "teoremas-vetoriais",
  "edos-intro",
];

const prerequisiteTopics = [
  "fatoracao",
  "equacoes",
  "funcoes",
  "trigonometria",
  "log-exp",
  "geometria-analitica",
];

export const videoResources: VideoResource[] = [
  {
    id: "practice-fme-vol8",
    kind: "practice",
    title: "Resolução FME Vol. 8: limites, derivadas e integrais",
    channel: "Fundamentos da Matemática Elementar",
    description: "Lista extensa de exercícios resolvidos para treinar cálculo básico.",
    youtubeUrl: "https://www.youtube.com/playlist?list=PL02HlAooX5Paa-C0-ge8OtxIR_OtWL8Gz",
    embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=PL02HlAooX5Paa-C0-ge8OtxIR_OtWL8Gz",
    topicIds: [...calculusOneTopics, ...prerequisiteTopics],
  },
  {
    id: "practice-precalculo-fundamentos",
    kind: "practice",
    title: "Pré-cálculo com exercícios de base",
    channel: "Curso de Pré-Cálculo",
    description: "Treino guiado de álgebra, funções, trigonometria e logaritmos.",
    youtubeUrl: "https://www.youtube.com/playlist?list=PLb735fZHArLbdyi9D1_yvz0ronIwvOKCl",
    embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=PLb735fZHArLbdyi9D1_yvz0ronIwvOKCl",
    topicIds: prerequisiteTopics,
  },
  {
    id: "practice-calculo-i-exercicios",
    kind: "practice",
    title: "Cálculo 1 com exercícios resolvidos",
    channel: "Curso Preparatório de Cálculo",
    description: "Treino de limites, derivadas e integrais com foco em graduação.",
    youtubeUrl: "https://www.youtube.com/playlist?list=PLe82WKsecrpxjeZO4P6yV1BrwihjGDJbR",
    embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=PLe82WKsecrpxjeZO4P6yV1BrwihjGDJbR",
    topicIds: calculusOneTopics,
  },
  {
    id: "practice-calculo-ii-ufrrj",
    kind: "practice",
    title: "Cálculo II: exercícios e resumos",
    channel: "Prof. Montauban Moreira de Oliveira Jr. / UFRRJ",
    description: "Aulas de apoio para integração, sequências, séries e tópicos de várias variáveis.",
    youtubeUrl: "https://www.youtube.com/playlist?list=PLwrfdhMyXahdgmxkB1Y2SPNirRiCDbfH7",
    embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=PLwrfdhMyXahdgmxkB1Y2SPNirRiCDbfH7",
    topicIds: [...calculusTwoTopics, "funcoes-varias", "derivadas-parciais", "integrais-multiplas"],
  },
  {
    id: "practice-calculo-vetorial",
    kind: "practice",
    title: "Cálculo vetorial aplicado",
    channel: "Aulas de Cálculo Vetorial",
    description: "Exercícios e aulas para campos vetoriais, integrais de linha e teoremas vetoriais.",
    youtubeUrl: "https://www.youtube.com/playlist?list=PLmtT_GZAQdt9rjzn-Sze2ABVZpYPKUMYe",
    embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=PLmtT_GZAQdt9rjzn-Sze2ABVZpYPKUMYe",
    topicIds: [...calculusThreeTopics, ...calculusFourTopics],
  },
  {
    id: "theory-precalculo-geral",
    kind: "theory",
    title: "Pré-cálculo: fundamentos para Cálculo",
    channel: "Curso de Pré-Cálculo",
    description: "Organiza a base algébrica e funcional necessária antes de limites e derivadas.",
    youtubeUrl: "https://www.youtube.com/playlist?list=PLb735fZHArLbdyi9D1_yvz0ronIwvOKCl",
    embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=PLb735fZHArLbdyi9D1_yvz0ronIwvOKCl",
    topicIds: prerequisiteTopics,
  },
  {
    id: "theory-aquino-calculo-i",
    kind: "theory",
    title: "Cálculo I: curso completo",
    channel: "Professor Aquino - Matemática",
    description: "Sequência conceitual de limites, derivadas e integrais.",
    youtubeUrl: "https://www.youtube.com/playlist?list=PLFAD938CE631F6449",
    embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=PLFAD938CE631F6449",
    topicIds: calculusOneTopics,
  },
  {
    id: "theory-calculo-i-completo",
    kind: "theory",
    title: "Cálculo I: limite, derivada e integral",
    channel: "Curso Completo de Cálculo I",
    description: "Fundamentos de Cálculo 1 para revisar antes das listas.",
    youtubeUrl: "https://www.youtube.com/playlist?list=PL83s8LGM84J7Xgfq4t-IEHcg3fGSZkS9H",
    embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=PL83s8LGM84J7Xgfq4t-IEHcg3fGSZkS9H",
    topicIds: calculusOneTopics,
  },
  {
    id: "theory-calculo-i-limite-derivada-integral",
    kind: "theory",
    title: "Cálculo I: panorama e fundamentos",
    channel: "Cálculo I - Limite, Derivada e Integral",
    description: "Playlist de base para entender a linguagem do cálculo diferencial e integral.",
    youtubeUrl: "https://www.youtube.com/playlist?list=PLrOyM49ctTx8go5KFpSr-EMScIPygZNob",
    embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=PLrOyM49ctTx8go5KFpSr-EMScIPygZNob",
    topicIds: [...calculusOneTopics, ...calculusTwoTopics],
  },
  {
    id: "theory-calculo-ii-ufrrj",
    kind: "theory",
    title: "Cálculo II: sequência de aulas",
    channel: "Prof. Montauban Moreira de Oliveira Jr. / UFRRJ",
    description: "Fundamentos para técnicas de integração, séries e transição para várias variáveis.",
    youtubeUrl: "https://www.youtube.com/playlist?list=PLwrfdhMyXahdgmxkB1Y2SPNirRiCDbfH7",
    embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=PLwrfdhMyXahdgmxkB1Y2SPNirRiCDbfH7",
    topicIds: [...calculusTwoTopics, "funcoes-varias", "derivadas-parciais", "integrais-multiplas"],
  },
  {
    id: "theory-calculo-vetorial",
    kind: "theory",
    title: "Cálculo vetorial: fundamentos",
    channel: "Aulas de Cálculo Vetorial",
    description: "Base para campos vetoriais, integrais de linha, superfícies e teoremas.",
    youtubeUrl: "https://www.youtube.com/playlist?list=PLmtT_GZAQdt9rjzn-Sze2ABVZpYPKUMYe",
    embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=PLmtT_GZAQdt9rjzn-Sze2ABVZpYPKUMYe",
    topicIds: [...calculusThreeTopics, ...calculusFourTopics],
  },
  {
    id: "prereq-precalculo-geral",
    kind: "prerequisite",
    title: "Pré-cálculo para começar Cálculo I",
    channel: "Curso de Pré-Cálculo",
    description: "Revisão de álgebra, funções, trigonometria, logaritmos e exponenciais.",
    youtubeUrl: "https://www.youtube.com/playlist?list=PLb735fZHArLbdyi9D1_yvz0ronIwvOKCl",
    embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=PLb735fZHArLbdyi9D1_yvz0ronIwvOKCl",
    prerequisiteIds: [
      "pre-fatoracao",
      "pre-produtos-notaveis",
      "pre-equacoes",
      "pre-funcoes",
      "pre-trigonometria",
      "pre-log-exp",
      "pre-geometria",
    ],
    topicIds: ["fatoracao", "equacoes", "funcoes", "trigonometria", "log-exp", "geometria-analitica"],
  },
  {
    id: "prereq-fatoracao-reginaldo",
    kind: "prerequisite",
    title: "Produtos notáveis e fatoração",
    channel: "Matemática - Prof. Reginaldo Moraes",
    description: "Base algébrica para simplificar limites, frações parciais e expressões racionais.",
    youtubeUrl: "https://www.youtube.com/playlist?list=PLG864KXex56kKXHx5qQuzuba5TfWtn0gu",
    embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=PLG864KXex56kKXHx5qQuzuba5TfWtn0gu",
    prerequisiteIds: ["pre-fatoracao", "pre-produtos-notaveis"],
    topicIds: ["fatoracao", "limites", "tecnicas-integracao"],
  },
  {
    id: "prereq-produtos-fatoracao-aula",
    kind: "prerequisite",
    title: "Produtos notáveis e fatoração em aula única",
    channel: "Pré-Cálculo",
    description: "Aula direta para destravar fator comum, diferença de quadrados e trinômios.",
    youtubeUrl: "https://www.youtube.com/watch?v=TeYfU0zfv-c",
    embedUrl: "https://www.youtube-nocookie.com/embed/TeYfU0zfv-c",
    prerequisiteIds: ["pre-fatoracao", "pre-produtos-notaveis"],
    topicIds: ["fatoracao", "limites"],
  },
  {
    id: "prereq-funcoes-log",
    kind: "prerequisite",
    title: "Funções logarítmicas no pré-cálculo",
    channel: "Pré-Cálculo: Funções Logarítmicas",
    description: "Revisão de logaritmos para derivadas, integrais e séries.",
    youtubeUrl: "https://www.youtube.com/playlist?list=PL9MoO_zt9BPSJnSFka14eLwrCdBUoTFAx",
    embedUrl: "https://www.youtube-nocookie.com/embed/videoseries?list=PL9MoO_zt9BPSJnSFka14eLwrCdBUoTFAx",
    prerequisiteIds: ["pre-log-exp", "pre-funcoes"],
    topicIds: ["log-exp", "derivadas", "integrais", "series-potencias"],
  },
  {
    id: "prereq-funcoes-exp-aquino",
    kind: "prerequisite",
    title: "Função exponencial",
    channel: "Professor Aquino - Matemática",
    description: "Base de exponenciais para crescimento, derivadas, integrais e séries.",
    youtubeUrl: "https://www.youtube.com/watch?v=xQT_bimVH-8",
    embedUrl: "https://www.youtube-nocookie.com/embed/xQT_bimVH-8",
    prerequisiteIds: ["pre-log-exp", "pre-funcoes"],
    topicIds: ["log-exp", "derivadas", "series-potencias"],
  },
];

export function getVideosForQuestion(question: Question): QuestionVideos {
  return {
    practice: getMatches(question, "practice"),
    theory: getMatches(question, "theory"),
    prerequisite: getMatches(question, "prerequisite"),
  };
}

function getMatches(question: Question, kind: VideoKind) {
  const matches = videoResources.filter((video) => {
    if (video.kind !== kind) {
      return false;
    }

    const matchesTopic = video.topicIds?.includes(question.topicId);
    const matchesPrerequisite = video.prerequisiteIds?.some((id) =>
      question.prerequisiteIds.includes(id),
    );

    return matchesTopic || matchesPrerequisite;
  });

  return matches.slice(0, 3);
}
