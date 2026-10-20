/* Boutique FFN · utilidades compartilhadas pela loja (index.html) e pela página de finalizar (finalizar.html) */
window.FFN = (() => {
  const WHATSAPP = LOJA.whatsapp;
  const CHAVE_SACOLA = "ffn-sacola";
  const PESO_PADRAO = 300; // gramas por peça quando o produto não informa `peso`

  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const semAcento = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const porId = (id) => PRODUTOS.find((p) => p.id === id);

  // cor das bolinhas de cada nome de cor
  const CORES = {
    preto: "#151515", branco: "#ffffff", gelo: "#e6eaec", "off-white": "#f3efe6", cinza: "#8a8f94", mescla: "#b9babb",
    marrom: "#6b4430", bege: "#d8c3a2", areia: "#d9c6a4", "azul-marinho": "#1f2a44", azul: "#4a76a8",
    verde: "#2f5d46", "verde-oliva": "#6b7046", rosa: "#e8a0b4",
  };
  const corDe = (nome) => CORES[semAcento(nome)] || "conic-gradient(#e8a0b4, #4a76a8, #c9a14a, #2f5d46, #e8a0b4)";

  const midia = (p) =>
    p.imagem
      ? `<img src="${esc(p.imagem)}" alt="${esc(p.nome)}" loading="lazy">`
      : `<div class="sem-foto"><img src="assets/img/panda.webp" alt=""><span>${esc(p.nome)}</span></div>`;

  function carregarSacola() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_SACOLA)) || [];
      return salvo.filter((i) => porId(i.id));
    } catch {
      return [];
    }
  }
  function salvarSacola(sacola) {
    try { localStorage.setItem(CHAVE_SACOLA, JSON.stringify(sacola)); } catch { /* navegação privada: sacola fica só na sessão */ }
  }

  const totalSacola = (sacola) => sacola.reduce((s, i) => s + porId(i.id).preco * i.qtd, 0);
  const qtdSacola = (sacola) => sacola.reduce((s, i) => s + i.qtd, 0);
  const pesoSacola = (sacola) => sacola.reduce((s, i) => s + (porId(i.id).peso || PESO_PADRAO) * i.qtd, 0);
  const linkWhats = (msg) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;

  // Lista de itens com quantidade e remover (gaveta e página de finalizar)
  function htmlItens(sacola) {
    return sacola
      .map((i, idx) => {
        const p = porId(i.id);
        return `
        <li class="item">
          <div class="item__img">${midia(p)}</div>
          <div>
            <p class="item__nome">${esc(p.nome)}</p>
            <p class="item__var">${esc(i.cor)} · Tam. ${esc(i.tamanho)}</p>
            <div class="qtd">
              <button type="button" data-menos="${idx}" aria-label="Diminuir">−</button>
              <output>${i.qtd}</output>
              <button type="button" data-mais="${idx}" aria-label="Aumentar">+</button>
            </div>
          </div>
          <div class="item__lado">
            <strong>${brl(p.preco * i.qtd)}</strong>
            <button type="button" class="item__remover" data-remover="${idx}">Remover</button>
          </div>
        </li>`;
      })
      .join("");
  }

  // Aplica um clique de +, − ou Remover; devolve true se mudou
  function editarItem(sacola, botao) {
    const d = botao.dataset;
    if (d.mais) sacola[d.mais].qtd = Math.min(20, sacola[d.mais].qtd + 1);
    else if (d.menos) {
      const i = sacola[d.menos];
      i.qtd > 1 ? i.qtd-- : sacola.splice(d.menos, 1);
    } else if (d.remover) sacola.splice(d.remover, 1);
    else return false;
    return true;
  }

  /* ---------- Pedidos: etapas (iguais às do servidor, api/_pedidos.js) ---------- */
  const ETAPAS = {
    correios: ["aprovado", "separando", "enviado", "saiu", "entregue"],
    local: ["aprovado", "separando", "saiu", "entregue"],
    retirada: ["aprovado", "separando", "pronto", "entregue"],
  };
  const NOMES = {
    aguardando: "Aguardando pagamento", aprovado: "Pagamento aprovado", separando: "Separando seu pedido",
    enviado: "Enviado pelos Correios", saiu: "Saiu para entrega", pronto: "Pronto para retirar", entregue: "Entregue", cancelado: "Cancelado",
  };
  const nomeStatus = (tipo, s) => (s === "entregue" && tipo === "retirada" ? "Retirado na loja" : NOMES[s]);
  const linkAcompanhar = (id, chave) => new URL(`acompanhar.html?pedido=${encodeURIComponent(id)}${chave ? `&chave=${chave}` : ""}`, location.href).href;
  const dataHora = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  /* ---------- Modo demonstração: pedidos guardados no navegador ---------- */
  const CHAVE_DEMO = "ffn-pedidos-demo";
  const demo = {
    listar() {
      try { return JSON.parse(localStorage.getItem(CHAVE_DEMO)) || []; } catch { return []; }
    },
    salvar(p) {
      const lista = demo.listar().filter((x) => x.id !== p.id);
      lista.unshift(p);
      try { localStorage.setItem(CHAVE_DEMO, JSON.stringify(lista.slice(0, 50))); } catch { /* sem espaço */ }
    },
    obter: (id) => demo.listar().find((p) => p.id === id) || null,
    mudarStatus(p, status, nota) {
      if (p.status === status) return;
      p.status = status;
      p.atualizadoEm = new Date().toISOString();
      p.historico.push({ status, em: p.atualizadoEm, ...(nota ? { nota } : {}) });
    },
    // mesma forma da versão pública do servidor
    publico(p) {
      return {
        id: p.id, criadoEm: p.criadoEm, status: p.status, nomeStatus: nomeStatus(p.entrega.tipo, p.status), primeiroNome: p.cliente.nome.split(" ")[0],
        entrega: { tipo: p.entrega.tipo, descricao: p.entrega.descricao, cidade: p.entrega.cidade, uf: p.entrega.uf },
        etapas: (ETAPAS[p.entrega.tipo] || ETAPAS.correios).map((s) => ({ status: s, nome: nomeStatus(p.entrega.tipo, s), em: p.historico.find((h) => h.status === s)?.em || null })),
        historico: p.historico.map((h) => ({ ...h, nome: nomeStatus(p.entrega.tipo, h.status) })),
        itens: p.itens, total: p.total, frete: p.frete, pagamento: p.pagamento, rastreio: p.rastreio || "",
      };
    },
  };

  /* ---------- Dados legais da loja no rodapé ---------- */
  document.querySelectorAll("[data-loja-legal]").forEach((el) => {
    const partes = [LOJA.razaoSocial, LOJA.cnpj && `CNPJ ${LOJA.cnpj}`, LOJA.endereco, LOJA.email].filter(Boolean);
    el.textContent = partes.join(" · ");
  });

  return { corDe, WHATSAPP, brl, esc, semAcento, porId, midia, carregarSacola, salvarSacola, totalSacola, qtdSacola, pesoSacola, linkWhats, htmlItens, editarItem, ETAPAS, NOMES, nomeStatus, linkAcompanhar, dataHora, demo };
})();
