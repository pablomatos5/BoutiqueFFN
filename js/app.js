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
  const filtro = { categoria: "todas", busca: "" };
  const contagem = (k) => (k === "todas" ? PRODUTOS.length : PRODUTOS.filter((p) => p.categoria === k).length);

  function montarAbasCategoria() {
    const abas = [["todas", "Tudo"], ...Object.entries(CATEGORIAS)];
    $("#chipsCategoria").innerHTML = abas
      .map(([k, nome]) => `<button type="button" role="tab" class="aba-cat" data-categoria="${k}">${esc(nome)}<span>${contagem(k)}</span></button>`)
      .join("");
  }

  function renderVitrine() {
    const termo = semAcento(filtro.busca.trim());
    // buscando, procura em todas as categorias
    const categoria = termo ? "todas" : filtro.categoria;
    const lista = PRODUTOS.filter((p) => {
      if (categoria !== "todas" && p.categoria !== categoria) return false;
      if (termo && !semAcento(`${p.nome} ${p.descricao} ${CATEGORIAS[p.categoria]} ${p.selo || ""} ${p.cores.join(" ")}`).includes(termo)) return false;
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
    $("#resumoFiltro").textContent = termo
      ? `${lista.length} ${lista.length === 1 ? "peça encontrada" : "peças encontradas"} para “${filtro.busca.trim()}”`
      : `${lista.length} ${lista.length === 1 ? "peça" : "peças"}`;
    $("#limparBusca").hidden = !filtro.busca;

    document.querySelectorAll("#chipsCategoria .aba-cat").forEach((c) => {
      const ativa = c.dataset.categoria === categoria;
      c.setAttribute("aria-selected", String(ativa));
      if (ativa && !termo) c.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    });
  }

  function aplicarFiltro({ categoria = "todas" }) {
    filtro.categoria = categoria;
    filtro.busca = "";
    $("#busca").value = "";
    renderVitrine();
    $("#loja").scrollIntoView();
  }

  document.addEventListener("click", (e) => {
    const atalho = e.target.closest("[data-filtro-categoria]");
    if (atalho) {
      e.preventDefault();
      fecharMenu();
      aplicarFiltro({ categoria: atalho.dataset.filtroCategoria });
      return;
    }
    const abrir = e.target.closest("[data-abrir]");
    if (abrir) abrirProduto(abrir.dataset.abrir);
  });

  $("#chipsCategoria").addEventListener("click", (e) => {
    const c = e.target.closest("[data-categoria]");
    if (!c) return;
    filtro.categoria = c.dataset.categoria;
    filtro.busca = "";
    $("#busca").value = "";
    renderVitrine();
  });
  let esperaBusca;
  $("#busca").addEventListener("input", (e) => {
    filtro.busca = e.target.value;
    clearTimeout(esperaBusca);
    esperaBusca = setTimeout(renderVitrine, 120); // não redesenha a cada tecla
  });
  $("#limparBusca").addEventListener("click", () => {
    filtro.busca = "";
    $("#busca").value = "";
    renderVitrine();
    $("#busca").focus();
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

  /* ---------- Mapa sob demanda (o do Google pesa ~1 MB) ---------- */
  $("#carregarMapa")?.addEventListener("click", (e) => {
    const capa = e.currentTarget;
    const iframe = Object.assign(document.createElement("iframe"), {
      title: "Mapa: Boutique FFN, Rua 13 de Maio, Cametá-PA",
      src: capa.dataset.src,
      referrerPolicy: "no-referrer-when-downgrade",
      allowFullscreen: true,
    });
    capa.replaceWith(iframe);
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
  montarAbasCategoria();
  renderVitrine();
  renderSacola();
})();
