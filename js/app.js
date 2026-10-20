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
          ${FFN.fotosDe(p).length > 1 ? `<img class="card__foto2" src="${esc(FFN.fotosDe(p)[1].src)}" alt="" loading="lazy" decoding="async"><span class="card__fotos" aria-label="${FFN.fotosDe(p).length} fotos">📷 ${FFN.fotosDe(p).length}</span>` : ""}
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
    return lista
      .map((v) => `<button type="button" class="chip${tipo === "cor" ? " chip--cor" : ""}" data-${tipo}="${esc(v)}" aria-pressed="false">${tipo === "cor" ? `<span class="bolinha" style="background:${FFN.corDe(v)}"></span>` : ""}${esc(v)}</button>`)
      .join("");
  }

  /* ---------- Galeria de fotos da peça ---------- */
  const galeria = { fotos: [], atual: 0 };

  function montarGaleria(p) {
    const fotos = FFN.fotosDe(p);
    galeria.fotos = fotos;
    galeria.atual = 0;
    if (!fotos.length) {
      $("#modalMedia").innerHTML = `${FFN.semFoto(p)}<p class="galeria__embreve">Fotos em breve 📸</p>`;
      return;
    }
    const varias = fotos.length > 1;
    $("#modalMedia").innerHTML = `
      <div class="galeria${varias ? " galeria--varias" : ""}">
        <div class="galeria__trilho" id="galeriaTrilho" tabindex="0" aria-label="Fotos de ${esc(p.nome)}${varias ? `, ${fotos.length} fotos. Deslize para ver` : ""}">
          ${fotos.map((f, i) => `<figure class="galeria__foto"><img src="${esc(f.src)}" alt="${esc(p.nome)}${f.cor ? `, cor ${esc(f.cor)}` : ""}${varias ? ` (foto ${i + 1} de ${fotos.length})` : ""}" ${i ? 'loading="lazy"' : ""} decoding="async" data-ampliar="${i}"></figure>`).join("")}
        </div>
        ${varias ? `
        <button type="button" class="galeria__seta galeria__seta--ant" data-ir="-1" aria-label="Foto anterior">‹</button>
        <button type="button" class="galeria__seta galeria__seta--prox" data-ir="1" aria-label="Próxima foto">›</button>
        <div class="galeria__pontos">${fotos.map((_, i) => `<button type="button" data-foto="${i}" aria-label="Foto ${i + 1}"${i ? "" : ' aria-current="true"'}></button>`).join("")}</div>
        <span class="galeria__contador" id="galeriaContador">1/${fotos.length}</span>` : ""}
        <button type="button" class="galeria__ampliar" data-ampliar="0" aria-label="Ver em tela cheia">⤢</button>
      </div>
      ${varias ? `<div class="galeria__miniaturas">${fotos.map((f, i) => `<button type="button" data-foto="${i}" aria-label="Foto ${i + 1}"${i ? "" : ' aria-current="true"'}><img src="${esc(f.src)}" alt="" loading="lazy" decoding="async"></button>`).join("")}</div>` : ""}`;

    const trilho = $("#galeriaTrilho");
    let quadro;
    trilho.addEventListener("scroll", () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => marcarFoto(Math.round(trilho.scrollLeft / trilho.clientWidth)));
    }, { passive: true });
  }

  function marcarFoto(i) {
    if (i === galeria.atual && i) return;
    galeria.atual = Math.max(0, Math.min(galeria.fotos.length - 1, i));
    document.querySelectorAll("#modalMedia [data-foto]").forEach((b) => b.toggleAttribute("aria-current", Number(b.dataset.foto) === galeria.atual));
    const contador = $("#galeriaContador");
    if (contador) contador.textContent = `${galeria.atual + 1}/${galeria.fotos.length}`;
    document.querySelectorAll("#modalMedia .galeria__ampliar").forEach((b) => (b.dataset.ampliar = galeria.atual));
  }

  function irParaFoto(i, suave = true) {
    const trilho = $("#galeriaTrilho");
    if (!trilho) return;
    const alvo = (i + galeria.fotos.length) % galeria.fotos.length;
    trilho.scrollTo({ left: alvo * trilho.clientWidth, behavior: suave ? "smooth" : "auto" });
    marcarFoto(alvo);
  }

  // tela cheia: fotos inteiras, fundo escuro; no celular dá para dar zoom com os dedos
  function ampliar(i) {
    const tela = document.createElement("div");
    tela.className = "galeria-cheia";
    tela.setAttribute("role", "dialog");
    tela.setAttribute("aria-label", "Fotos em tela cheia");
    tela.innerHTML = `<button type="button" class="galeria-cheia__fechar" aria-label="Fechar">×</button>
      <div class="galeria-cheia__trilho">${galeria.fotos.map((f) => `<img src="${esc(f.src)}" alt="" decoding="async">`).join("")}</div>`;
    modal.appendChild(tela);
    const trilho = tela.querySelector(".galeria-cheia__trilho");
    trilho.scrollLeft = i * trilho.clientWidth;
    const fechar = () => {
      irParaFoto(Math.round(trilho.scrollLeft / trilho.clientWidth), false);
      tela.remove();
    };
    tela.querySelector(".galeria-cheia__fechar").addEventListener("click", fechar);
    tela.querySelector(".galeria-cheia__fechar").focus();
    galeria.fecharCheia = fechar;
  }

  $("#modalMedia").addEventListener("click", (e) => {
    const ir = e.target.closest("[data-ir]");
    if (ir) return irParaFoto(galeria.atual + Number(ir.dataset.ir));
    const foto = e.target.closest("[data-foto]");
    if (foto) return irParaFoto(Number(foto.dataset.foto));
    const zoom = e.target.closest("[data-ampliar]");
    if (zoom) ampliar(Number(zoom.dataset.ampliar));
  });
  $("#modalMedia").addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") irParaFoto(galeria.atual + 1);
    if (e.key === "ArrowLeft") irParaFoto(galeria.atual - 1);
  });
  // Esc fecha primeiro a tela cheia, depois a peça
  modal.addEventListener("cancel", (e) => {
    const cheia = modal.querySelector(".galeria-cheia");
    if (cheia) { e.preventDefault(); galeria.fecharCheia?.(); }
  });

  function guiaMedidas(p) {
    const m = MEDIDAS[p.categoria];
    const linhas = m && p.tamanhos.filter((t) => m.linhas[t]);
    if (!linhas?.length) return "";
    return `<table><thead><tr><th>Tam.</th>${m.colunas.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${linhas.map((t) => `<tr><th>${esc(t)}</th>${m.linhas[t].map((v) => `<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <p>Medidas da peça em centímetros, aproximadas. Na dúvida, chama no WhatsApp que a gente ajuda a escolher.</p>`;
  }

  function abrirProduto(id, { doEndereco = false } = {}) {
    const p = porId(id);
    if (!p) return;
    // cada peça tem seu link (?produto=...): dá para mandar no WhatsApp e nos Stories, e o "voltar" do celular fecha a peça
    const url = new URL(location.href);
    url.searchParams.set("produto", id);
    url.hash = "";
    if (doEndereco || history.state?.produto) history.replaceState({ produto: id, empurrado: history.state?.empurrado }, "", url);
    else history.pushState({ produto: id, empurrado: true }, "", url);
    document.title = `${p.nome} · Boutique FFN`;
    Object.assign(escolha, {
      produto: p,
      cor: p.cores.length === 1 ? p.cores[0] : null,
      tamanho: p.tamanhos.length === 1 ? p.tamanhos[0] : null,
      qtd: 1,
    });
    montarGaleria(p);
    $("#modalCategoria").textContent = CATEGORIAS[p.categoria];
    $("#modalNome").textContent = p.nome;
    $("#modalPreco").innerHTML = `${p.precoDe ? `<s>${brl(p.precoDe)}</s>` : ""}${brl(p.preco)}`;
    $("#modalDescricao").textContent = p.descricao;
    $("#modalCores").innerHTML = chipsOpcao(p.cores, "cor");
    $("#modalTamanhos").innerHTML = chipsOpcao(p.tamanhos, "tamanho");
    const guia = guiaMedidas(p);
    $("#guiaMedidas").innerHTML = guia;
    $("#guiaMedidas").hidden = true;
    $("#verMedidas").hidden = !guia;
    $("#verMedidas").setAttribute("aria-expanded", "false");
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
    if (c) {
      escolha.cor = c.dataset.cor;
      atualizarEscolha();
      const i = galeria.fotos.findIndex((f) => f.cor && FFN.semAcento(f.cor) === FFN.semAcento(escolha.cor));
      if (i >= 0) irParaFoto(i);
    }
  });
  $("#modalTamanhos").addEventListener("click", (e) => {
    const c = e.target.closest("[data-tamanho]");
    if (c) { escolha.tamanho = c.dataset.tamanho; atualizarEscolha(); }
  });
  $("#qtdMenos").addEventListener("click", () => { escolha.qtd = Math.max(1, escolha.qtd - 1); atualizarEscolha(); });
  $("#qtdMais").addEventListener("click", () => { escolha.qtd = Math.min(20, escolha.qtd + 1); atualizarEscolha(); });
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });

  const TITULO = document.title;
  let fechandoPeloVoltar = false;
  modal.addEventListener("close", () => {
    document.title = TITULO;
    if (fechandoPeloVoltar) { fechandoPeloVoltar = false; return; }
    // só volta no histórico se foi o site que abriu a peça; quem chegou pelo link fica na loja
    if (history.state?.empurrado) history.back();
    else {
      const url = new URL(location.href);
      url.searchParams.delete("produto");
      history.replaceState(null, "", url);
    }
  });
  addEventListener("popstate", () => {
    if (modal.open && !history.state?.produto) { fechandoPeloVoltar = true; modal.close(); }
  });

  $("#verMedidas").addEventListener("click", () => {
    const guia = $("#guiaMedidas");
    guia.hidden = !guia.hidden;
    $("#verMedidas").setAttribute("aria-expanded", String(!guia.hidden));
  });

  $("#compartilhar").addEventListener("click", async () => {
    const p = escolha.produto;
    const url = new URL(location.href);
    url.searchParams.set("produto", p.id);
    const dados = { title: `${p.nome} · Boutique FFN`, text: `Olha esse ${p.nome} da Boutique FFN 🐼`, url: url.href };
    try {
      if (navigator.share) await navigator.share(dados);
      else {
        await navigator.clipboard.writeText(url.href);
        $("#compartilhar").lastChild.textContent = " Link copiado!";
        setTimeout(() => ($("#compartilhar").lastChild.textContent = " Compartilhar"), 2000);
      }
    } catch { /* cliente cancelou */ }
  });

  $("#adicionarSacola").addEventListener("click", () => {
    if (!escolha.cor || !escolha.tamanho) {
      $("#modalAviso").textContent = `Escolha ${!escolha.cor ? "a cor" : ""}${!escolha.cor && !escolha.tamanho ? " e " : ""}${!escolha.tamanho ? "o tamanho" : ""}.`;
      return;
    }
    adicionar(escolha.produto.id, escolha.cor, escolha.tamanho, escolha.qtd);
    const origem = $("#modalMedia").getBoundingClientRect();
    modal.close();
    // efeitos.js anima a peça voando até a sacola e mostra o aviso
    document.dispatchEvent(new CustomEvent("ffn:adicionado", { detail: { origem, imagem: galeria.fotos[galeria.atual]?.src || FFN.fotoPrincipal(escolha.produto), nome: escolha.produto.nome } }));
  });

  /* ---------- Cupom no link (?cupom=...) vale até o checkout ---------- */
  const cupomNoLink = new URLSearchParams(location.search).get("cupom");
  if (cupomNoLink) {
    try { sessionStorage.setItem("ffn-cupom", cupomNoLink); } catch { /* ok */ }
  }

  /* ---------- Campanha (js/loja.js) ---------- */
  const campanha = LOJA.campanha || {};
  if (campanha.aviso) {
    const texto = `${campanha.aviso}${campanha.cupom ? ` · cupom ${campanha.cupom}` : ""}`;
    document.querySelectorAll(".topbar__grupo").forEach((g) => {
      const span = document.createElement("span");
      span.className = "topbar__campanha";
      span.textContent = texto;
      g.prepend(span);
    });
  }
  const fim = campanha.ate && new Date(`${campanha.ate}T23:59:59-03:00`);
  if (fim && fim > new Date()) {
    const selo = document.createElement("p");
    selo.className = "contagem";
    $(".hero__text").prepend(selo);
    const tique = () => {
      const resta = Math.max(0, fim - Date.now());
      const d = Math.floor(resta / 864e5), h = Math.floor((resta % 864e5) / 36e5), m = Math.floor((resta % 36e5) / 6e4);
      selo.textContent = `${campanha.aviso || "Promoção"} · termina em ${d ? `${d}d ` : ""}${h}h ${String(m).padStart(2, "0")}min`;
      if (!resta) selo.remove();
    };
    tique();
    setInterval(tique, 30_000);
  }

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
  const produtoNoLink = new URLSearchParams(location.search).get("produto");
  if (produtoNoLink && porId(produtoNoLink)) abrirProduto(produtoNoLink, { doEndereco: true });
})();
