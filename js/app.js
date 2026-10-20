/* Boutique FFN · vitrine, sacola e pedido pelo WhatsApp */
(() => {
  const WHATSAPP = "5591985106107";
  const CHAVE_SACOLA = "ffn-sacola";

  const $ = (sel) => document.querySelector(sel);
  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const porId = (id) => PRODUTOS.find((p) => p.id === id);

  const midia = (p) =>
    p.imagem
      ? `<img src="${esc(p.imagem)}" alt="${esc(p.nome)}" loading="lazy">`
      : `<div class="sem-foto"><img src="assets/img/panda.svg" alt=""><span>${esc(p.nome)}</span></div>`;

  /* ---------- Vitrine ---------- */
  const filtro = { categoria: "todas", publico: "todos", busca: "" };

  function montarChipsCategoria() {
    const chips = [["todas", "Tudo"], ...Object.entries(CATEGORIAS)];
    $("#chipsCategoria").innerHTML = chips
      .map(([k, nome]) => `<button class="chip" data-categoria="${k}">${esc(nome)}</button>`)
      .join("");
  }

  function renderVitrine() {
    const termo = semAcento(filtro.busca.trim());
    const lista = PRODUTOS.filter((p) => {
      if (filtro.categoria !== "todas" && p.categoria !== filtro.categoria) return false;
      if (filtro.publico !== "todos" && p.publico !== filtro.publico && p.publico !== "unissex") return false;
      if (termo && !semAcento(`${p.nome} ${p.descricao} ${CATEGORIAS[p.categoria]} ${p.selo || ""}`).includes(termo)) return false;
      return true;
    });

    $("#gridProdutos").innerHTML = lista
      .map(
        (p) => `
      <article class="card">
        <button class="card__media" data-abrir="${p.id}" aria-label="Ver ${esc(p.nome)}">
          ${midia(p)}
          ${p.selo ? `<span class="selo">${esc(p.selo)}</span>` : ""}
        </button>
        <div class="card__body">
          <span class="card__cat">${esc(CATEGORIAS[p.categoria])}</span>
          <h3 class="card__nome">${esc(p.nome)}</h3>
          <span class="card__cores">${p.cores.length} ${p.cores.length > 1 ? "cores" : "cor"} · ${esc(p.tamanhos.join(" "))}</span>
          <div class="card__rodape">
            <p class="preco">${p.precoDe ? `<s>${brl(p.precoDe)}</s>` : ""}${brl(p.preco)}</p>
            <button class="card__btn" data-abrir="${p.id}">Escolher</button>
          </div>
        </div>
      </article>`
      )
      .join("");
    $("#semResultados").hidden = lista.length > 0;

    document.querySelectorAll("#chipsCategoria .chip").forEach((c) => c.classList.toggle("is-active", c.dataset.categoria === filtro.categoria));
    document.querySelectorAll("#chipsPublico .chip").forEach((c) => c.classList.toggle("is-active", c.dataset.publico === filtro.publico));
  }

  function aplicarFiltro({ categoria = "todas", publico = "todos" }) {
    filtro.categoria = categoria;
    filtro.publico = publico;
    filtro.busca = "";
    $("#busca").value = "";
    renderVitrine();
    $("#loja").scrollIntoView();
  }

  document.addEventListener("click", (e) => {
    const atalho = e.target.closest("[data-filtro-categoria], [data-filtro-publico]");
    if (atalho) {
      e.preventDefault();
      fecharMenu();
      aplicarFiltro({ categoria: atalho.dataset.filtroCategoria, publico: atalho.dataset.filtroPublico });
      return;
    }
    const abrir = e.target.closest("[data-abrir]");
    if (abrir) abrirProduto(abrir.dataset.abrir);
  });

  $("#chipsCategoria").addEventListener("click", (e) => {
    const c = e.target.closest("[data-categoria]");
    if (!c) return;
    filtro.categoria = c.dataset.categoria;
    renderVitrine();
  });
  $("#chipsPublico").addEventListener("click", (e) => {
    const c = e.target.closest("[data-publico]");
    if (!c) return;
    filtro.publico = c.dataset.publico;
    renderVitrine();
  });
  $("#busca").addEventListener("input", (e) => {
    filtro.busca = e.target.value;
    renderVitrine();
  });

  /* ---------- Menu mobile ---------- */
  const nav = $("#nav");
  const botaoMenu = $("#abrirMenu");
  function fecharMenu() {
    nav.classList.remove("is-open");
    botaoMenu.setAttribute("aria-expanded", "false");
  }
  botaoMenu.addEventListener("click", () => {
    const aberto = nav.classList.toggle("is-open");
    botaoMenu.setAttribute("aria-expanded", String(aberto));
  });
  nav.addEventListener("click", (e) => e.target.closest("a") && fecharMenu());

  /* ---------- Detalhe do produto ---------- */
  const modal = $("#modalProduto");
  const escolha = { produto: null, cor: null, tamanho: null, qtd: 1 };

  function chipsOpcao(lista, tipo) {
    return lista.map((v) => `<button type="button" class="chip" data-${tipo}="${esc(v)}" aria-pressed="false">${esc(v)}</button>`).join("");
  }

  function abrirProduto(id) {
    const p = porId(id);
    if (!p) return;
    Object.assign(escolha, {
      produto: p,
      cor: p.cores.length === 1 ? p.cores[0] : null,
      tamanho: p.tamanhos.length === 1 ? p.tamanhos[0] : null,
      qtd: 1,
    });
    $("#modalMedia").innerHTML = midia(p);
    $("#modalCategoria").textContent = CATEGORIAS[p.categoria];
    $("#modalNome").textContent = p.nome;
    $("#modalPreco").innerHTML = `${p.precoDe ? `<s>${brl(p.precoDe)}</s>` : ""}${brl(p.preco)}`;
    $("#modalDescricao").textContent = p.descricao;
    $("#modalCores").innerHTML = chipsOpcao(p.cores, "cor");
    $("#modalTamanhos").innerHTML = chipsOpcao(p.tamanhos, "tamanho");
    $("#modalAviso").textContent = "";
    atualizarEscolha();
    modal.showModal();
  }

  function atualizarEscolha() {
    document.querySelectorAll("#modalCores .chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.cor === escolha.cor)));
    document.querySelectorAll("#modalTamanhos .chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.tamanho === escolha.tamanho)));
    $("#qtdValor").textContent = escolha.qtd;
  }

  $("#modalCores").addEventListener("click", (e) => {
    const c = e.target.closest("[data-cor]");
    if (c) { escolha.cor = c.dataset.cor; atualizarEscolha(); }
  });
  $("#modalTamanhos").addEventListener("click", (e) => {
    const c = e.target.closest("[data-tamanho]");
    if (c) { escolha.tamanho = c.dataset.tamanho; atualizarEscolha(); }
  });
  $("#qtdMenos").addEventListener("click", () => { escolha.qtd = Math.max(1, escolha.qtd - 1); atualizarEscolha(); });
  $("#qtdMais").addEventListener("click", () => { escolha.qtd = Math.min(20, escolha.qtd + 1); atualizarEscolha(); });
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });

  $("#adicionarSacola").addEventListener("click", () => {
    if (!escolha.cor || !escolha.tamanho) {
      $("#modalAviso").textContent = `Escolha ${!escolha.cor ? "a cor" : ""}${!escolha.cor && !escolha.tamanho ? " e " : ""}${!escolha.tamanho ? "o tamanho" : ""}.`;
      return;
    }
    adicionar(escolha.produto.id, escolha.cor, escolha.tamanho, escolha.qtd);
    modal.close();
    abrirSacola();
  });

  /* ---------- Sacola ---------- */
  let sacola = carregar();

  function carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_SACOLA)) || [];
      return salvo.filter((i) => porId(i.id));
    } catch {
      return [];
    }
  }
  function salvar() {
    try { localStorage.setItem(CHAVE_SACOLA, JSON.stringify(sacola)); } catch { /* navegação privada: sacola fica só na sessão */ }
  }

  const chaveItem = (i) => `${i.id}|${i.cor}|${i.tamanho}`;

  function adicionar(id, cor, tamanho, qtd) {
    const existente = sacola.find((i) => chaveItem(i) === `${id}|${cor}|${tamanho}`);
    if (existente) existente.qtd += qtd;
    else sacola.push({ id, cor, tamanho, qtd });
    salvar();
    renderSacola();
  }

  const totalSacola = () => sacola.reduce((s, i) => s + porId(i.id).preco * i.qtd, 0);

  function renderSacola() {
    const qtdTotal = sacola.reduce((s, i) => s + i.qtd, 0);
    $("#contadorCarrinho").textContent = qtdTotal;
    $("#sacolaVazia").hidden = sacola.length > 0;
    $("#sacolaRodape").hidden = sacola.length === 0;
    $("#sacolaTotal").textContent = brl(totalSacola());
    $("#sacolaLista").innerHTML = sacola
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
    if (sacola.length === 0) mostrarEtapa("itens");
  }

  $("#sacolaLista").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.mais) sacola[b.dataset.mais].qtd = Math.min(20, sacola[b.dataset.mais].qtd + 1);
    else if (b.dataset.menos) {
      const i = sacola[b.dataset.menos];
      i.qtd > 1 ? i.qtd-- : sacola.splice(b.dataset.menos, 1);
    } else if (b.dataset.remover) sacola.splice(b.dataset.remover, 1);
    salvar();
    renderSacola();
  });

  const gaveta = $("#sacola");
  const fundo = $("#sacolaFundo");
  function abrirSacola() {
    fundo.hidden = false;
    gaveta.classList.add("is-open");
    gaveta.setAttribute("aria-hidden", "false");
    $("#fecharCarrinho").focus();
  }
  function fecharSacola() {
    gaveta.classList.remove("is-open");
    gaveta.setAttribute("aria-hidden", "true");
    fundo.hidden = true;
  }
  $("#abrirCarrinho").addEventListener("click", abrirSacola);
  $("#fecharCarrinho").addEventListener("click", fecharSacola);
  fundo.addEventListener("click", fecharSacola);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && gaveta.classList.contains("is-open")) fecharSacola(); });

  /* ---------- Checkout via WhatsApp ---------- */
  const form = $("#checkout");

  function mostrarEtapa(etapa) {
    const checkout = etapa === "checkout";
    $("#sacolaEtapaItens").hidden = checkout;
    form.hidden = !checkout;
    $("#irCheckout").hidden = checkout;
    $("#enviarPedido").hidden = !checkout;
  }

  $("#irCheckout").addEventListener("click", () => { mostrarEtapa("checkout"); form.nome.focus(); });
  $("#voltarItens").addEventListener("click", () => mostrarEtapa("itens"));
  form.addEventListener("change", () => { $("#campoEndereco").hidden = form.entrega.value !== "entrega"; });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = form.nome.value.trim();
    const entrega = form.entrega.value;
    const endereco = form.endereco.value.trim();
    if (!nome) { $("#checkoutAviso").textContent = "Informe seu nome."; form.nome.focus(); return; }
    if (entrega === "entrega" && !endereco) { $("#checkoutAviso").textContent = "Informe o endereço de entrega."; form.endereco.focus(); return; }
    $("#checkoutAviso").textContent = "";

    const linhas = sacola.map((i) => {
      const p = porId(i.id);
      return `• ${i.qtd}x ${p.nome} (${i.cor}, tam. ${i.tamanho}): ${brl(p.preco * i.qtd)}`;
    });
    const msg = [
      `Olá, Boutique FFN! Quero fazer um pedido pelo site:`,
      ``,
      ...linhas,
      ``,
      `*Total: ${brl(totalSacola())}*`,
      ``,
      `Nome: ${nome}`,
      entrega === "entrega" ? `Entrega em: ${endereco}` : `Vou retirar na loja`,
      `Pagamento: ${form.pagamento.value}`,
      form.obs.value.trim() ? `Obs.: ${form.obs.value.trim()}` : "",
    ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n").trim();

    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  });

  /* ---------- Início ---------- */
  $("#ano").textContent = new Date().getFullYear();
  montarChipsCategoria();
  renderVitrine();
  renderSacola();
})();
