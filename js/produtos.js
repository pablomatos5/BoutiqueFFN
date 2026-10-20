/*
 * Catálogo da Boutique FFN.
 *
 * Para cadastrar um produto, copie um bloco e ajuste os campos:
 *   id        identificador único, sem espaços (usado no carrinho)
 *   nome      nome exibido
 *   categoria uma das chaves de CATEGORIAS abaixo
 *   publico   "masculino" | "feminino" | "unissex"
 *   preco     número em reais (ex.: 89.9)
 *   precoDe   opcional, preço antigo para mostrar promoção
 *   imagem    caminho da foto (assets/img/...). Sem foto, o site mostra um card na identidade da loja
 *   cores     lista de cores disponíveis
 *   tamanhos  lista de tamanhos disponíveis
 *   selo      opcional: "Novidade", "Lupo", "Mais vendido"...
 *   descricao texto curto do produto
 *
 * ATENÇÃO: os preços abaixo são provisórios e precisam ser confirmados com a loja.
 */

const CATEGORIAS = {
  shorts: "Shorts & Bermudas",
  camisas: "Camisas",
  feminino: "Peças Femininas",
  lupo: "Lupo",
  acessorios: "Acessórios",
};

const PRODUTOS = [
  {
    id: "short-sarja-madrid",
    nome: "Short Sarja Madrid",
    categoria: "shorts",
    publico: "masculino",
    preco: 89.9,
    imagem: "assets/img/short-sarja-madrid.jpg",
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
    publico: "masculino",
    preco: 89.9,
    imagem: "assets/img/short-sarja-texturizado.jpg",
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
    publico: "masculino",
    preco: 99.9,
    cores: ["Areia", "Off-white", "Preto"],
    tamanhos: ["P", "M", "G", "GG"],
    descricao: "Leve e fresco para o calor de Cametá. Linho com cós de elástico e cordão.",
  },
  {
    id: "bermuda-sarja",
    nome: "Bermuda de Sarja",
    categoria: "shorts",
    publico: "masculino",
    preco: 109.9,
    cores: ["Bege", "Preto", "Verde-oliva"],
    tamanhos: ["38", "40", "42", "44", "46"],
    descricao: "Bermuda de sarja com bolsos laterais, para o dia a dia com estilo.",
  },
  {
    id: "camisa-basica",
    nome: "Camiseta Básica Premium",
    categoria: "camisas",
    publico: "masculino",
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
    publico: "masculino",
    preco: 79.9,
    cores: ["Estampa da semana"],
    tamanhos: ["P", "M", "G", "GG"],
    descricao: "Estampas que mudam toda semana. Chame no WhatsApp para ver as opções disponíveis.",
  },
  {
    id: "conjunto-fitness",
    nome: "Conjunto Fitness Top + Legging",
    categoria: "feminino",
    publico: "feminino",
    preco: 149.9,
    cores: ["Verde", "Preto", "Rosa"],
    tamanhos: ["P", "M", "G"],
    descricao: "Top e legging de tecido com compressão, que veste bem do treino ao rolê.",
  },
  {
    id: "vestido-feminino",
    nome: "Vestido Feminino",
    categoria: "feminino",
    publico: "feminino",
    preco: 119.9,
    cores: ["Rosa", "Azul", "Preto"],
    tamanhos: ["P", "M", "G"],
    descricao: "Peças femininas selecionadas toda semana. Consulte modelos e cores no WhatsApp.",
  },
  {
    id: "meia-lupo-kit",
    nome: "Kit de Meias Lupo",
    categoria: "lupo",
    publico: "unissex",
    preco: 49.9,
    cores: ["Preto", "Branco", "Mescla"],
    tamanhos: ["34-38", "39-43"],
    selo: "Lupo",
    descricao: "Meias Lupo: conforto e durabilidade da marca que todo mundo conhece.",
  },
  {
    id: "cueca-lupo",
    nome: "Cueca Boxer Lupo",
    categoria: "lupo",
    publico: "masculino",
    preco: 39.9,
    cores: ["Preto", "Azul-marinho", "Cinza"],
    tamanhos: ["P", "M", "G", "GG"],
    selo: "Lupo",
    descricao: "Boxer Lupo sem costura, que veste bem e não marca.",
  },
  {
    id: "bone-ffn",
    nome: "Boné",
    categoria: "acessorios",
    publico: "unissex",
    preco: 59.9,
    cores: ["Preto", "Verde"],
    tamanhos: ["Único"],
    descricao: "Para fechar o look. Fica feio nunca.",
  },
];
