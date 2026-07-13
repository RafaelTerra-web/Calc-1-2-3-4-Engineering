export type CourseId = "pre-calculo" | "calculo-1" | "calculo-2" | "calculo-3" | "calculo-4";

export type Course = {
  id: CourseId;
  code: string;
  title: string;
  symbol: string;
  description: string;
  application: string;
  tone: string;
};

export type Topic = {
  id: string;
  courseId: CourseId;
  title: string;
  description: string;
  outcomes: [string, string];
  videoId?: string;
  videoTitle?: string;
};

export type Question = {
  id: string;
  courseId: CourseId;
  topicId: string;
  prompt: string;
  options: [string, string, string, string];
  correct: number;
  explanation: string;
  gap: string;
  difficulty: "Base" | "Intermediário" | "Avançado";
};

export const courses: Course[] = [
  {
    id: "pre-calculo",
    code: "BASE",
    title: "Pré-cálculo",
    symbol: "f(x)",
    description: "Álgebra, funções, trigonometria e geometria analítica para entrar em Cálculo sem lacunas ocultas.",
    application: "Ler modelos, escalas, gráficos e relações entre grandezas físicas.",
    tone: "#2b6f62",
  },
  {
    id: "calculo-1",
    code: "C1",
    title: "Cálculo I",
    symbol: "lim",
    description: "Limites, continuidade, derivadas, otimização e a entrada no pensamento integral.",
    application: "Taxas de variação, velocidade, deformação e otimização de projetos.",
    tone: "#1f6f8b",
  },
  {
    id: "calculo-2",
    code: "C2",
    title: "Cálculo II",
    symbol: "∫",
    description: "Técnicas de integração, integrais impróprias, sequências e aproximações por séries.",
    application: "Áreas, volumes, trabalho, carga distribuída e aproximação numérica.",
    tone: "#a45f24",
  },
  {
    id: "calculo-3",
    code: "C3",
    title: "Cálculo III",
    symbol: "∂",
    description: "Vetores, funções multivariáveis, gradiente e integração em duas ou três dimensões.",
    application: "Superfícies, campos térmicos, volumes e otimização com várias variáveis.",
    tone: "#a04855",
  },
  {
    id: "calculo-4",
    code: "C4",
    title: "Cálculo IV",
    symbol: "∇",
    description: "Campos vetoriais, integrais de linha e superfície, teoremas clássicos e EDOs.",
    application: "Fluxo, circulação, transporte, eletromagnetismo e sistemas dinâmicos.",
    tone: "#694c91",
  },
];

export const topics: Topic[] = [
  { id: "fatoracao", courseId: "pre-calculo", title: "Fatoração", description: "Produtos notáveis, fator comum, diferença de quadrados e trinômios.", outcomes: ["Simplificar expressões racionais", "Reconhecer padrões de fatoração"], videoId: "-4fmIx_EZDw", videoTitle: "Produtos notáveis: resumão com exercícios" },
  { id: "equacoes", courseId: "pre-calculo", title: "Equações", description: "Equações lineares, quadráticas e racionais com restrições de domínio.", outcomes: ["Resolver equações com segurança", "Conferir raízes e restrições"], videoId: "eNIxHmdAvQY", videoTitle: "Equação do 2º grau com exercícios" },
  { id: "funcoes", courseId: "pre-calculo", title: "Funções", description: "Domínio, imagem, composição, inversas e leitura de gráficos.", outcomes: ["Ler o comportamento de funções", "Compor e inverter funções simples"], videoId: "swZRlLUMuwU", videoTitle: "Função composta em 7 minutos" },
  { id: "trigonometria", courseId: "pre-calculo", title: "Trigonometria", description: "Círculo trigonométrico, identidades e transformações usadas em Cálculo.", outcomes: ["Usar identidades fundamentais", "Reconhecer arcos notáveis"], videoId: "DLAI0CAJn6E", videoTitle: "Relação fundamental da trigonometria" },
  { id: "log-exp", courseId: "pre-calculo", title: "Logaritmos e exponenciais", description: "Propriedades, crescimento e resolução de equações logarítmicas e exponenciais.", outcomes: ["Manipular logaritmos", "Resolver equações exponenciais"], videoId: "oza6zrCMOPM", videoTitle: "Função logarítmica: rápido e fácil" },
  { id: "geometria-analitica", courseId: "pre-calculo", title: "Geometria analítica", description: "Retas, cônicas, distância, vetores e o plano cartesiano.", outcomes: ["Trabalhar com retas e distâncias", "Traduzir geometria em equações"], videoId: "xeqom87mlY4", videoTitle: "Geometria analítica com questões" },

  { id: "limites", courseId: "calculo-1", title: "Limites", description: "Limites laterais, leis, simplificação algébrica e limites notáveis.", outcomes: ["Avaliar formas indeterminadas", "Usar álgebra antes do limite"], videoId: "s3j69Fd3GWM", videoTitle: "Cálculo de limites: exercícios" },
  { id: "continuidade", courseId: "calculo-1", title: "Continuidade", description: "Continuidade em ponto e intervalo, com classificação de descontinuidades.", outcomes: ["Classificar descontinuidades", "Aplicar critérios de continuidade"] },
  { id: "derivadas", courseId: "calculo-1", title: "Derivadas", description: "Definição, regras, cadeia, derivação implícita e interpretação física.", outcomes: ["Derivar funções compostas", "Interpretar taxas de variação"], videoId: "91UN2cbzBGY", videoTitle: "Derivada da exponencial e do logaritmo" },
  { id: "aplicacoes-derivadas", courseId: "calculo-1", title: "Aplicações de derivadas", description: "Otimização, taxas relacionadas, monotonicidade e concavidade.", outcomes: ["Montar modelos de otimização", "Usar testes com derivadas"], videoId: "PMOEMs00Jz4", videoTitle: "Máximos e mínimos com derivadas" },
  { id: "integrais", courseId: "calculo-1", title: "Primeiras integrais", description: "Primitivas, integral definida e interpretação como acumulação e área.", outcomes: ["Integrar formas básicas", "Aplicar o Teorema Fundamental"], videoId: "M_xCxHcBdBo", videoTitle: "Integral indefinida sem mistério" },

  { id: "tecnicas-integracao", courseId: "calculo-2", title: "Técnicas de integração", description: "Substituição, partes, frações parciais e substituição trigonométrica.", outcomes: ["Escolher a técnica adequada", "Decompor funções racionais"], videoId: "H0dGRxkodl0", videoTitle: "Integração por frações parciais" },
  { id: "integrais-improprias", courseId: "calculo-2", title: "Integrais impróprias", description: "Intervalos infinitos, assíntotas verticais e convergência.", outcomes: ["Converter integrais em limites", "Decidir convergência"], videoId: "nCbocso-Pbw", videoTitle: "Integrais impróprias com limites infinitos" },
  { id: "sequencias-series", courseId: "calculo-2", title: "Sequências e séries", description: "Convergência, comparação, razão, raiz e séries alternadas.", outcomes: ["Selecionar testes de convergência", "Estimar o comportamento dos termos"], videoId: "7WgL16ehNuU", videoTitle: "Limite de sequências" },
  { id: "series-potencias", courseId: "calculo-2", title: "Séries de potências", description: "Raio, intervalo de convergência e séries de Taylor.", outcomes: ["Encontrar intervalos de convergência", "Construir aproximações de Taylor"], videoId: "SkwQIg5oIKw", videoTitle: "Taylor e Maclaurin com exercícios" },

  { id: "vetores", courseId: "calculo-3", title: "Vetores e espaço", description: "Produtos escalar e vetorial, planos e geometria espacial.", outcomes: ["Calcular produtos vetoriais", "Encontrar planos e distâncias"], videoId: "vI3HTBycd2Y", videoTitle: "Produto escalar, norma e ângulo" },
  { id: "funcoes-varias", courseId: "calculo-3", title: "Funções de várias variáveis", description: "Domínios, curvas de nível, superfícies e limites em R² e R³.", outcomes: ["Interpretar curvas de nível", "Analisar domínios multivariáveis"] },
  { id: "derivadas-parciais", courseId: "calculo-3", title: "Derivadas parciais", description: "Gradiente, regra da cadeia, derivadas direcionais e planos tangentes.", outcomes: ["Calcular gradientes", "Aproximar com planos tangentes"], videoId: "fa_FJvqxSeA", videoTitle: "Derivadas parciais: exercícios resolvidos" },
  { id: "integrais-multiplas", courseId: "calculo-3", title: "Integrais múltiplas", description: "Integrais duplas e triplas, mudanças de coordenadas e aplicações.", outcomes: ["Montar regiões de integração", "Trocar ordem e coordenadas"], videoId: "Z9ORGP7YLLE", videoTitle: "Integral dupla: exercício guiado" },

  { id: "campos-vetoriais", courseId: "calculo-4", title: "Campos vetoriais", description: "Campos conservativos, divergente, rotacional e leitura geométrica.", outcomes: ["Classificar campos", "Calcular divergente e rotacional"], videoId: "jEv90om82IY", videoTitle: "Divergente de um campo vetorial" },
  { id: "integrais-linha", courseId: "calculo-4", title: "Integrais de linha", description: "Trabalho, circulação, curvas parametrizadas e dependência do caminho.", outcomes: ["Parametrizar curvas", "Calcular integrais de trabalho"], videoId: "zwjR1StdNjY", videoTitle: "Parametrização de circunferência" },
  { id: "superficies", courseId: "calculo-4", title: "Superfícies", description: "Superfícies paramétricas, fluxo e integrais de superfície.", outcomes: ["Parametrizar superfícies", "Calcular integrais de fluxo"] },
  { id: "teoremas-vetoriais", courseId: "calculo-4", title: "Teoremas vetoriais", description: "Teoremas de Green, Stokes e Gauss/Divergência.", outcomes: ["Escolher o teorema adequado", "Converter fronteiras em regiões"], videoId: "jQ-SHqRhDbs", videoTitle: "Teorema de Green: exercício resolvido" },
  { id: "edos-intro", courseId: "calculo-4", title: "EDOs introdutórias", description: "Equações separáveis e lineares de primeira ordem.", outcomes: ["Resolver EDOs separáveis", "Usar fatores integrantes"] },
];

export const questions: Question[] = [
  { id: "q-pre-1", courseId: "pre-calculo", topicId: "fatoracao", prompt: "Qual fatoração está correta para x² − 9?", options: ["(x − 3)(x + 3)", "(x − 9)(x + 1)", "(x − 3)²", "x(x − 9)"], correct: 0, explanation: "É uma diferença de quadrados: x² − 3² = (x − 3)(x + 3).", gap: "Diferença de quadrados", difficulty: "Base" },
  { id: "q-pre-2", courseId: "pre-calculo", topicId: "funcoes", prompt: "Se f(x)=2x−1 e g(x)=x², qual é (g∘f)(3)?", options: ["25", "11", "5", "35"], correct: 0, explanation: "Primeiro f(3)=5; depois g(5)=25.", gap: "Ordem da composição de funções", difficulty: "Base" },
  { id: "q-pre-3", courseId: "pre-calculo", topicId: "trigonometria", prompt: "Qual expressão equivale a 1 − cos²(x)?", options: ["sen²(x)", "cos²(x)", "tan²(x)", "sec²(x)"], correct: 0, explanation: "Da identidade sen²(x)+cos²(x)=1, segue que 1−cos²(x)=sen²(x).", gap: "Identidade trigonométrica fundamental", difficulty: "Base" },
  { id: "q-c1-1", courseId: "calculo-1", topicId: "limites", prompt: "Calcule lim x→2 de (x²−4)/(x−2).", options: ["0", "2", "4", "Não existe"], correct: 2, explanation: "Fatore x²−4=(x−2)(x+2). Após simplificar, o limite de x+2 é 4.", gap: "Fatoração antes da substituição", difficulty: "Base" },
  { id: "q-c1-2", courseId: "calculo-1", topicId: "derivadas", prompt: "Qual é a derivada de f(x)=eˣ+ln(x)?", options: ["eˣ + 1/x", "xeˣ⁻¹ + 1/x", "eˣ + x", "eˣ − 1/x"], correct: 0, explanation: "A derivada de eˣ é eˣ e a de ln(x) é 1/x, para x>0.", gap: "Derivadas exponencial e logarítmica", difficulty: "Base" },
  { id: "q-c1-3", courseId: "calculo-1", topicId: "aplicacoes-derivadas", prompt: "Para f(x)=x²−4x+1, em qual x ocorre o ponto crítico?", options: ["−2", "0", "2", "4"], correct: 2, explanation: "f′(x)=2x−4. Igualando a zero, obtemos x=2.", gap: "Resolver f′(x)=0", difficulty: "Intermediário" },
  { id: "q-c1-4", courseId: "calculo-1", topicId: "integrais", prompt: "Qual é uma primitiva de 3x²?", options: ["x³+C", "6x+C", "x²+C", "9x³+C"], correct: 0, explanation: "Pela regra da potência, ∫3x²dx=x³+C.", gap: "Regra da potência", difficulty: "Base" },
  { id: "q-c2-1", courseId: "calculo-2", topicId: "tecnicas-integracao", prompt: "Como iniciar a decomposição de 1/(x²−1) em frações parciais?", options: ["A/(x−1)+B/(x+1)", "A/x²+B/(−1)", "A/(x−1)²", "A/(x+1)²"], correct: 0, explanation: "Como x²−1=(x−1)(x+1), cada fator linear recebe uma parcela.", gap: "Fatoração para frações parciais", difficulty: "Intermediário" },
  { id: "q-c2-2", courseId: "calculo-2", topicId: "integrais-improprias", prompt: "A integral de 1/x² entre 1 e infinito é:", options: ["Divergente", "Convergente e vale 1", "Convergente e vale 2", "Não pode ser escrita como limite"], correct: 1, explanation: "∫₁ᵇx⁻²dx=1−1/b. Quando b→∞, o resultado é 1.", gap: "Limite no infinito", difficulty: "Intermediário" },
  { id: "q-c2-3", courseId: "calculo-2", topicId: "sequencias-series", prompt: "Se aₙ=1/n, qual é o limite quando n→∞?", options: ["0", "1", "∞", "Não existe"], correct: 0, explanation: "Conforme n cresce, 1/n se aproxima de zero.", gap: "Comportamento assintótico", difficulty: "Base" },
  { id: "q-c2-4", courseId: "calculo-2", topicId: "series-potencias", prompt: "A série de Taylor de eˣ em torno de zero começa com:", options: ["1+x+x²/2!+x³/3!+…", "x+x²+x³+…", "1−x+x²−x³+…", "ln(x)+x+…"], correct: 0, explanation: "eˣ=Σxⁿ/n!, portanto os primeiros termos seguem essa expansão.", gap: "Forma da série de eˣ", difficulty: "Intermediário" },
  { id: "q-c3-1", courseId: "calculo-3", topicId: "vetores", prompt: "O produto escalar de u=(1,2,0) e v=(3,−1,4) é:", options: ["1", "5", "8", "12"], correct: 0, explanation: "u·v=1·3+2·(−1)+0·4=1.", gap: "Produto escalar em ℝ³", difficulty: "Base" },
  { id: "q-c3-2", courseId: "calculo-3", topicId: "derivadas-parciais", prompt: "Para f(x,y)=x²y+y³, qual é ∂f/∂x?", options: ["2xy", "x²+3y²", "2xy+3y²", "2x+y"], correct: 0, explanation: "Ao derivar em x, y é constante; x²y vira 2xy e y³ vira zero.", gap: "Variável versus constante", difficulty: "Intermediário" },
  { id: "q-c3-3", courseId: "calculo-3", topicId: "integrais-multiplas", prompt: "A integral dupla de 1 sobre um retângulo R mede:", options: ["A área de R", "O perímetro de R", "Sempre zero", "A diagonal de R"], correct: 0, explanation: "Integrar a função constante 1 sobre uma região plana retorna sua área.", gap: "Interpretação geométrica", difficulty: "Base" },
  { id: "q-c4-1", courseId: "calculo-4", topicId: "campos-vetoriais", prompt: "Para F(x,y)=(x,y), qual é a divergência em ℝ²?", options: ["0", "1", "2", "x+y"], correct: 2, explanation: "div F=∂x/∂x+∂y/∂y=1+1=2.", gap: "Definição de divergência", difficulty: "Intermediário" },
  { id: "q-c4-2", courseId: "calculo-4", topicId: "integrais-linha", prompt: "A curva r(t)=(cos t, sen t), 0≤t≤2π, descreve:", options: ["Um segmento", "A circunferência unitária", "Uma parábola", "Uma elipse de eixo maior 2"], correct: 1, explanation: "cos²t+sen²t=1 e o intervalo percorre uma volta completa.", gap: "Leitura de parametrização", difficulty: "Base" },
  { id: "q-c4-3", courseId: "calculo-4", topicId: "teoremas-vetoriais", prompt: "O Teorema de Green relaciona uma integral de linha fechada no plano com:", options: ["Uma integral dupla na região interna", "Uma integral tripla", "Uma série de potências", "Uma derivada ordinária"], correct: 0, explanation: "Green converte a circulação na fronteira em uma integral dupla sobre a região plana.", gap: "Escolha do teorema vetorial", difficulty: "Avançado" },
];

export const studySteps = [
  ["01", "Diagnosticar", "Descubra a lacuna antes de começar a matéria."],
  ["02", "Compreender", "Conecte a notação a uma ideia geométrica ou física."],
  ["03", "Resolver", "Acompanhe um exemplo com decisões explícitas."],
  ["04", "Recuperar", "Resolva sem olhar e revise o erro, não a resposta."],
] as const;
