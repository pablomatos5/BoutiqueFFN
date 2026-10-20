/* Boutique FFN · utilidades compartilhadas pela loja (index.html) e pela página de finalizar (finalizar.html) */
window.FFN = (() => {
  const WHATSAPP = "5591985106107";
  const CHAVE_SACOLA = "ffn-sacola";
  const PESO_PADRAO = 300; // gramas por peça quando o produto não informa `peso`

  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const semAcento = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const porId = (id) => PRODUTOS.find((p) => p.id === id);

  const midia = (p) =>
    p.imagem
      ? `<img src="${esc(p.imagem)}" alt="${esc(p.nome)}" loading="lazy">`
      : `<div class="sem-foto"><img src="assets/img/panda.svg" alt=""><span>${esc(p.nome)}</span></div>`;

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

  return { WHATSAPP, brl, esc, semAcento, porId, midia, carregarSacola, salvarSacola, totalSacola, qtdSacola, pesoSacola, linkWhats, htmlItens, editarItem };
})();
