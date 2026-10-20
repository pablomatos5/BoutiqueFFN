/*
 * Catálogo da Boutique FFN.
 *
 * Para cadastrar um produto, copie um bloco e ajuste os campos:
 *   id        identificador único, sem espaços (usado no carrinho)
 *   nome      nome exibido
 *   categoria uma das chaves de CATEGORIAS abaixo
 *   preco     número em reais (ex.: 89.9)
 *   precoDe   opcional, preço antigo para mostrar promoção
 *   fotos     lista de fotos (assets/img/...), a primeira é a capa. Pode ter quantas quiser.
 *             Para ligar uma foto a uma cor: { src: "assets/img/x.webp", cor: "Marrom" }
 *             (ao escolher a cor, a galeria pula para essa foto). Sem fotos, aparece o card com o panda.
 *   cores     lista de cores disponíveis
 *   tamanhos  lista de tamanhos disponíveis
 *   peso      opcional, gramas por peça para o frete dos Correios (padrão 300)
 *   selo      opcional: "Novidade", "Lupo", "Mais vendido"...
 *   descricao texto curto do produto
 *
 * ATENÇÃO: os preços abaixo são provisórios e precisam ser confirmados com a loja.
 */

const CATEGORIAS = {
  shorts: "Shorts & Bermudas",
  camisas: "Camisas",
  feminino: "Feminino",
  lupo: "Lupo",
  acessorios: "Acessórios",
};

/*
 * Guia de medidas por categoria, em centímetros, medindo a peça esticada na mesa.
 * ATENÇÃO: medidas aproximadas de referência. Confirme com as peças da loja.
 */
const MEDIDAS = {
  shorts: { colunas: ["Cintura", "Quadril", "Comprimento"], linhas: { P: [38, 50, 44], M: [40, 53, 45], G: [43, 56, 46], GG: [46, 59, 47], 38: [38, 50, 52], 40: [40, 52, 53], 42: [42, 54, 54], 44: [44, 56, 55], 46: [46, 58, 56] } },
  camisas: { colunas: ["Peito", "Comprimento", "Ombro"], linhas: { P: [50, 70, 44], M: [53, 72, 46], G: [56, 74, 48], GG: [59, 76, 50] } },
  feminino: { colunas: ["Busto", "Cintura", "Quadril"], linhas: { P: [84, 66, 92], M: [90, 72, 98], G: [96, 78, 104] } },
};

const PRODUTOS = [
  {
    id: "short-sarja-madrid",
    nome: "Short Sarja Madrid",
    categoria: "shorts",
    preco: 89.9,
    fotos: ["assets/img/short-sarja-madrid-1.webp", "assets/img/short-sarja-madrid-2.webp"],
    cores: ["Preto", "Gelo", "Marrom", "Azul-marinho", "Azul"],
    tamanhos: ["P", "M", "G", "GG"],
    selo: "Novidade",
    descricao:
      "Totalmente liso, em sarja acetinada, com acabamento impecável e caimento perfeito. Cós de elástico com cordão. Estilo, conforto e elegância em uma só peça.",
  },
  {
    id: "short-sarja-texturizado",
    nome: "Short de Sarja Texturizado",
    categoria: "shorts",
    preco: 89.9,
    fotos: [
      { src: "assets/img/short-sarja-texturizado-1.webp", cor: "Marrom" },
      "assets/img/short-sarja-texturizado-2.webp",
      "assets/img/short-sarja-texturizado-3.webp",
    ],
    cores: ["Marrom", "Preto", "Bege", "Cinza"],
    tamanhos: ["P", "M", "G", "GG"],
    selo: "Novidade",
    descricao:
      "Sarja com textura canelada, qualidade e caimento perfeito. Versátil: combina com camisas básicas, estampadas, regatas e muito mais.",
  },
  {
    id: "short-linho",
    nome: "Short de Linho",
    categoria: "shorts",
    fotos: [],
    preco: 99.9,
    cores: ["Areia", "Off-white", "Preto"],
    tamanhos: ["P", "M", "G", "GG"],
    descricao: "Leve e fresco para o calor de Cametá. Linho com cós de elástico e cordão.",
  },
  {
    id: "bermuda-sarja",
    peso: 400,
    nome: "Bermuda de Sarja",
    categoria: "shorts",
    fotos: [],
    preco: 109.9,
    cores: ["Bege", "Preto", "Verde-oliva"],
    tamanhos: ["38", "40", "42", "44", "46"],
    descricao: "Bermuda de sarja com bolsos laterais, para o dia a dia com estilo.",
  },
  {
    id: "camisa-basica",
    nome: "Camiseta Básica Premium",
    categoria: "camisas",
    fotos: [],
    preco: 59.9,
    cores: ["Preto", "Branco", "Verde", "Cinza"],
    tamanhos: ["P", "M", "G", "GG"],
    selo: "Mais vendido",
    descricao: "Malha macia de algodão, gola reforçada. A base de qualquer look.",
  },
  {
    id: "camisa-estampada",
    nome: "Camisa Estampada",
    categoria: "camisas",
    fotos: [],
    preco: 79.9,
    cores: ["Estampa da semana"],
    tamanhos: ["P", "M", "G", "GG"],
    descricao: "Estampas que mudam toda semana. Chame no WhatsApp para ver as opções disponíveis.",
  },
  {
    id: "conjunto-fitness",
    peso: 350,
    nome: "Conjunto Fitness Top + Legging",
    categoria: "feminino",
    fotos: [],
    preco: 149.9,
    cores: ["Verde", "Preto", "Rosa"],
    tamanhos: ["P", "M", "G"],
    descricao: "Top e legging de tecido com compressão, que veste bem do treino ao rolê.",
  },
  {
    id: "vestido-feminino",
    nome: "Vestido Feminino",
    categoria: "feminino",
    fotos: [],
    preco: 119.9,
    cores: ["Rosa", "Azul", "Preto"],
    tamanhos: ["P", "M", "G"],
    descricao: "Peças femininas selecionadas toda semana. Consulte modelos e cores no WhatsApp.",
  },
  {
    id: "meia-lupo-kit",
    peso: 150,
    nome: "Kit de Meias Lupo",
    categoria: "lupo",
    fotos: [],
    preco: 49.9,
    cores: ["Preto", "Branco", "Mescla"],
    tamanhos: ["34-38", "39-43"],
    selo: "Lupo",
    descricao: "Meias Lupo: conforto e durabilidade da marca que todo mundo conhece.",
  },
  {
    id: "cueca-lupo",
    peso: 100,
    nome: "Cueca Boxer Lupo",
    categoria: "lupo",
    fotos: [],
    preco: 39.9,
    cores: ["Preto", "Azul-marinho", "Cinza"],
    tamanhos: ["P", "M", "G", "GG"],
    selo: "Lupo",
    descricao: "Boxer Lupo sem costura, que veste bem e não marca.",
  },
  {
    id: "bone-ffn",
    peso: 150,
    nome: "Boné",
    categoria: "acessorios",
    fotos: [],
    preco: 59.9,
    cores: ["Preto", "Verde"],
    tamanhos: ["Único"],
    descricao: "Para fechar o look. Fica feio nunca.",
  },
];
