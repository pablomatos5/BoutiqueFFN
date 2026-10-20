/*
 * Dados da loja usados em todo o site (rodapé, páginas legais, WhatsApp e campanhas).
 * Preencha razaoSocial, cnpj e email antes de publicar: a lei do comércio eletrônico
 * (Decreto 7.962/2013) exige razão social, CNPJ, endereço e contato visíveis no site.
 */
const LOJA = {
  nome: "Boutique FFN",
  razaoSocial: "", // ex.: "Fulana de Tal Comércio de Roupas LTDA"
  cnpj: "", // ex.: "00.000.000/0001-00"
  endereco: "Rua 13 de Maio, Centro (em frente ao Hotel Aricurá) · Cametá-PA · CEP 68400-000",
  whatsapp: "5591985106107",
  whatsappTexto: "(91) 98510-6107",
  email: "", // ex.: "contato@boutiqueffn.com.br"
  instagram: "boutiqueficafeionunca_",

  // Política de trocas (confirme com a loja)
  diasArrependimento: 7, // direito de arrependimento em compras online (CDC, art. 49): não mudar para menos
  diasTroca: 30, // troca por tamanho ou cor (cortesia da loja)

  /*
   * Campanha (opcional): muda as cores do site e mostra um aviso no topo.
   *   tema: "padrao" | "rosa" (Outubro Rosa) | "nazare" (Círio) | "natal"
   *   aviso: texto da faixa do topo; ate: data final (AAAA-MM-DD) para a contagem regressiva
   *   cupom: código para divulgar (precisa existir no painel → Cupons)
   */
  campanha: {
    tema: "padrao",
    aviso: "",
    ate: "",
    cupom: "",
  },
};
