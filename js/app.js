/* Boutique FFN · loja: vitrine, detalhe do produto e gaveta da sacola. O checkout fica em finalizar.html */
(() => {
  const { brl, esc, semAcento, porId, midia } = FFN;
  const $ = (sel) => document.querySelector(sel);

  // Quem volta do Mercado Pago para a página inicial (links antigos) segue para a página de finalizar
  if (new URLSearchParams(location.search).has("pagamento")) {
    location.replace(`finalizar.html${location.search}`);
    return;
  }

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
    const origem = $("#modalMedia").getBoundingClientRect();
    modal.close();
    // efeitos.js anima a peça voando até a sacola e mostra o aviso
    document.dispatchEvent(new CustomEvent("ffn:adicionado", { detail: { origem, imagem: escolha.produto.imagem, nome: escolha.produto.nome } }));
  });

  /* ---------- Sacola (gaveta) ---------- */
  let sacola = FFN.carregarSacola();

  function adicionar(id, cor, tamanho, qtd) {
    const existente = sacola.find((i) => i.id === id && i.cor === cor && i.tamanho === tamanho);
    if (existente) existente.qtd = Math.min(20, existente.qtd + qtd);
    else sacola.push({ id, cor, tamanho, qtd });
    FFN.salvarSacola(sacola);
    renderSacola();
  }

  function renderSacola() {
    $("#contadorCarrinho").textContent = FFN.qtdSacola(sacola);
    $("#sacolaVazia").hidden = sacola.length > 0;
    $("#sacolaRodape").hidden = sacola.length === 0;
    $("#sacolaLista").innerHTML = FFN.htmlItens(sacola);
    $("#sacolaSubtotal").textContent = brl(FFN.totalSacola(sacola));
  }

  $("#sacolaLista").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b && FFN.editarItem(sacola, b)) {
      FFN.salvarSacola(sacola);
      renderSacola();
    }
  });

  // a sacola pode mudar na página de finalizar (outra aba): mantém a gaveta em dia
  addEventListener("storage", (e) => {
    if (e.key === "ffn-sacola") { sacola = FFN.carregarSacola(); renderSacola(); }
  });
  addEventListener("pageshow", () => { sacola = FFN.carregarSacola(); renderSacola(); });

  const gaveta = $("#sacola");
  const fundo = $("#sacolaFundo");
  function abrirSacola() {
    $("#toast").hidden = true;
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
  $("#toastVer").addEventListener("click", abrirSacola);
  $("#fecharCarrinho").addEventListener("click", fecharSacola);
  $("#continuarComprando").addEventListener("click", fecharSacola);
  fundo.addEventListener("click", fecharSacola);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && gaveta.classList.contains("is-open")) fecharSacola(); });

  /* ---------- Início ---------- */
  $("#ano").textContent = new Date().getFullYear();
  montarChipsCategoria();
  renderVitrine();
  renderSacola();
})();
