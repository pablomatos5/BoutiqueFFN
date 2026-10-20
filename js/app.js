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
    sacolaMudou();
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

  /* ---------- Checkout: entrega e frete ---------- */
  const form = $("#checkout");
  const PESO_PADRAO = 300; // gramas por peça quando o produto não informa `peso`
  // tipo: "retirada" | "gratis" (Cametá) | "correios" | "combinar" (API indisponível) | null (falta calcular)
  let frete = { tipo: "retirada", valor: 0 };
  let cotacao = null; // { cep, local, opcoes }

  const pesoSacola = () => sacola.reduce((s, i) => s + (porId(i.id).peso || PESO_PADRAO) * i.qtd, 0);
  const ehCameta = (local) => local.uf === "PA" && semAcento(local.localidade) === "cameta";

  function atualizarTotais() {
    const sub = totalSacola();
    $("#sacolaSubtotal").textContent = brl(sub);
    const emCheckout = !form.hidden;
    $("#linhaFrete").hidden = !emCheckout;
    const rotulo = {
      retirada: "Grátis (retirada)",
      gratis: "Grátis (Cametá)",
      correios: frete.valor != null ? brl(frete.valor) : "",
      combinar: "A combinar",
    }[frete.tipo] || "Informe o CEP";
    $("#sacolaFrete").textContent = rotulo;
    $("#sacolaTotal").textContent = brl(sub + (emCheckout && frete.valor ? frete.valor : 0));
  }

  function mostrarEtapa(etapa) {
    const checkout = etapa === "checkout";
    $("#sacolaEtapaItens").hidden = checkout;
    form.hidden = !checkout;
    $("#irCheckout").hidden = checkout;
    $("#pagarMP").hidden = !checkout;
    $("#enviarPedido").hidden = !checkout;
    atualizarTotais();
  }

  $("#irCheckout").addEventListener("click", () => { mostrarEtapa("checkout"); form.nome.focus(); });
  $("#voltarItens").addEventListener("click", () => mostrarEtapa("itens"));

  function statusFrete(texto, classe = "") {
    const el = $("#freteStatus");
    el.textContent = texto;
    el.className = `frete-status ${classe}`;
  }

  function definirEntrega() {
    const entrega = form.entrega.value === "entrega";
    $("#campoEndereco").hidden = !entrega;
    if (!entrega) frete = { tipo: "retirada", valor: 0 };
    else if (frete.tipo === "retirada") aplicarCotacao();
    atualizarTotais();
  }
  form.entrega.forEach((r) => r.addEventListener("change", definirEntrega));

  // Aplica a cotação guardada (ou pede o CEP, se não houver)
  function aplicarCotacao() {
    $("#freteOpcoes").innerHTML = "";
    if (!cotacao) { frete = { tipo: null, valor: null }; return; }
    if (cotacao.gratis) {
      frete = { tipo: "gratis", valor: 0 };
      statusFrete("Entrega grátis em Cametá! 🐼", "is-gratis");
    } else if (cotacao.opcoes?.length) {
      $("#freteOpcoes").innerHTML = cotacao.opcoes
        .map((o, i) => `
          <label class="frete-op">
            <input type="radio" name="servico" value="${i}" ${i === 0 ? "checked" : ""}>
            <span>${esc(o.servico)}<small>${o.prazo ? `até ${o.prazo} dias úteis` : "prazo informado no envio"}</small></span>
            <strong>${brl(o.preco)}</strong>
          </label>`)
        .join("");
      escolherServico(0);
      statusFrete(`Envio pelos Correios para ${cotacao.local.localidade}-${cotacao.local.uf}`);
    } else {
      frete = { tipo: "combinar", valor: 0 };
      statusFrete("Não conseguimos calcular o frete agora. A gente combina o valor com você no WhatsApp.", "is-erro");
    }
  }

  function escolherServico(i) {
    const o = cotacao.opcoes[i];
    frete = { tipo: "correios", valor: o.preco, servico: o.servico, prazo: o.prazo };
    atualizarTotais();
  }
  $("#freteOpcoes").addEventListener("change", (e) => {
    if (e.target.name === "servico") escolherServico(Number(e.target.value));
  });

  async function calcularFrete() {
    const cep = form.cep.value.replace(/\D/g, "");
    if (cep.length !== 8) { statusFrete("Digite um CEP com 8 números.", "is-erro"); return; }
    cotacao = null;
    $("#freteOpcoes").innerHTML = "";
    $("#enderecoCampos").hidden = true;
    statusFrete("Consultando CEP…");

    let local;
    try {
      local = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
    } catch {
      local = null;
    }
    if (!local || local.erro) { statusFrete("CEP não encontrado. Confira os números.", "is-erro"); frete = { tipo: null, valor: null }; atualizarTotais(); return; }

    form.rua.value = local.logradouro || "";
    form.bairro.value = local.bairro || "";
    $("#enderecoCidade").textContent = `${local.localidade} - ${local.uf}`;
    $("#enderecoCampos").hidden = false;

    if (ehCameta(local)) {
      cotacao = { cep, local, gratis: true };
    } else {
      statusFrete("Calculando frete nos Correios…");
      let opcoes = [];
      try {
        const r = await fetch(`api/frete?cep=${cep}&peso=${pesoSacola()}`);
        if (r.ok) opcoes = (await r.json()).opcoes || [];
      } catch { /* sem backend (ex.: prévia estática): frete a combinar */ }
      cotacao = { cep, local, opcoes };
    }
    aplicarCotacao();
    atualizarTotais();
    (form.rua.value ? form.numero : form.rua).focus();
  }

  $("#calcularFrete").addEventListener("click", calcularFrete);
  form.cep.addEventListener("input", () => {
    let v = form.cep.value.replace(/\D/g, "").slice(0, 8);
    form.cep.value = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
    if (v.length === 8 && v !== cotacao?.cep) calcularFrete();
  });
  form.cep.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); calcularFrete(); } });

  // A sacola mudou: o peso mudou, então a cotação dos Correios precisa ser refeita
  function sacolaMudou() {
    if (cotacao && !cotacao.gratis && cotacao.opcoes?.length) {
      cotacao = null;
      $("#freteOpcoes").innerHTML = "";
      if (form.entrega.value === "entrega") {
        frete = { tipo: null, valor: null };
        statusFrete("A sacola mudou. Calcule o frete de novo.");
      }
    }
    atualizarTotais();
  }

  // Valida o formulário; devolve os dados do pedido ou null
  function dadosPedido() {
    const aviso = (t, campo) => { $("#checkoutAviso").textContent = t; campo?.focus(); };
    const nome = form.nome.value.trim();
    const entrega = form.entrega.value === "entrega";
    if (!nome) return aviso("Informe seu nome.", form.nome), null;
    if (entrega) {
      if (!cotacao) return aviso("Informe o CEP e calcule o frete.", form.cep), null;
      if (!form.rua.value.trim()) return aviso("Informe a rua.", form.rua), null;
      if (!form.numero.value.trim()) return aviso("Informe o número.", form.numero), null;
    }
    aviso("");
    return {
      pedido: `FFN-${Date.now().toString(36).toUpperCase()}`,
      nome,
      entrega: entrega ? "entrega" : "retirada",
      cep: form.cep.value.replace(/\D/g, ""),
      servico: frete.tipo === "correios" ? cotacao.opcoes.find((o) => o.servico === frete.servico)?.codigo : undefined,
      endereco: { rua: form.rua.value.trim(), numero: form.numero.value.trim(), complemento: form.complemento.value.trim(), bairro: form.bairro.value.trim() },
      itens: sacola.map(({ id, cor, tamanho, qtd }) => ({ id, cor, tamanho, qtd })),
    };
  }

  function mensagemPedido(d, pagamento) {
    const linhas = sacola.map((i) => {
      const p = porId(i.id);
      return `• ${i.qtd}x ${p.nome} (${i.cor}, tam. ${i.tamanho}): ${brl(p.preco * i.qtd)}`;
    });
    const sub = totalSacola();
    let envio, freteTxt;
    if (d.entrega === "retirada") {
      envio = "Vou retirar na loja";
      freteTxt = "Frete: grátis (retirada)";
    } else {
      const l = cotacao.local;
      const e = d.endereco;
      envio = `Entregar em: ${[`${e.rua}, ${e.numero}`, e.complemento, e.bairro, `${l.localidade}-${l.uf}`, `CEP ${form.cep.value}`].filter(Boolean).join(" · ")}`;
      freteTxt = {
        gratis: "Frete: grátis (Cametá)",
        correios: `Frete: ${frete.servico} ${brl(frete.valor)}${frete.prazo ? ` (até ${frete.prazo} dias úteis)` : ""}`,
        combinar: "Frete: a combinar",
      }[frete.tipo];
    }
    return [
      `Olá, Boutique FFN! Pedido ${d.pedido} feito pelo site:`,
      ``,
      ...linhas,
      ``,
      `Subtotal: ${brl(sub)}`,
      freteTxt,
      `*Total: ${brl(sub + (frete.valor || 0))}*${frete.tipo === "combinar" ? " + frete" : ""}`,
      ``,
      `Nome: ${d.nome}`,
      envio,
      `Pagamento: ${pagamento}`,
      form.obs.value.trim() ? `Obs.: ${form.obs.value.trim()}` : "",
    ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n").trim();
  }

  const linkWhats = (msg) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;

  async function pagarMercadoPago(d) {
    const botao = $("#pagarMP");
    botao.disabled = true;
    botao.textContent = "Abrindo o Mercado Pago…";
    try {
      const r = await fetch("api/pagamento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      const resp = await r.json().catch(() => ({}));
      if (!r.ok || !resp.url) throw new Error(resp.erro);
      try { localStorage.setItem("ffn-pedido", JSON.stringify({ pedido: d.pedido, msg: mensagemPedido(d, "Mercado Pago") })); } catch { /* segue sem guardar */ }
      location.href = resp.url;
    } catch (err) {
      $("#checkoutAviso").textContent = `${err.message || "Não foi possível abrir o pagamento agora"}. Você pode finalizar pelo WhatsApp logo abaixo.`;
      botao.disabled = false;
      botao.textContent = "Pagar com Mercado Pago";
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = dadosPedido();
    if (!d) return;
    if (e.submitter?.value === "whats") window.open(linkWhats(mensagemPedido(d, "a combinar")), "_blank", "noopener");
    else pagarMercadoPago(d);
  });

  /* ---------- Volta do Mercado Pago ---------- */
  function retornoPagamento() {
    const q = new URLSearchParams(location.search);
    const status = q.get("pagamento");
    if (!status) return;
    history.replaceState(null, "", location.pathname + location.hash);

    let salvo = {};
    try { salvo = JSON.parse(localStorage.getItem("ffn-pedido")) || {}; } catch { /* sem dados */ }
    const pedido = q.get("external_reference") || salvo.pedido || "";
    const idPagamento = q.get("payment_id") || q.get("collection_id");
    const textos = {
      aprovado: ["Pagamento aprovado! 🐼", "Recebemos seu pagamento. Avise a loja no WhatsApp para combinar a entrega ou retirada."],
      pendente: ["Pagamento em análise", "Assim que o Mercado Pago confirmar (Pix ou boleto), a loja separa seu pedido."],
      falhou: ["Pagamento não concluído", "Nada foi cobrado. Sua sacola continua salva: tente de novo ou finalize pelo WhatsApp."],
    }[status];
    if (!textos) return;

    $("#retornoTitulo").textContent = textos[0];
    $("#retornoTexto").textContent = `${pedido ? `Pedido ${pedido}. ` : ""}${textos[1]}`;
    const situacao = { aprovado: "aprovado", pendente: "pendente", falhou: "não concluído" }[status];
    const msg = salvo.msg
      ? salvo.msg.replace(/Pagamento: Mercado Pago$/m, `Pagamento: Mercado Pago ${situacao}${idPagamento ? ` (ID ${idPagamento})` : ""}`)
      : `Olá, Boutique FFN! Fiz o pedido ${pedido} pelo site. Pagamento Mercado Pago ${situacao}${idPagamento ? ` (ID ${idPagamento})` : ""}.`;
    $("#retornoWhats").href = linkWhats(msg);

    if (status !== "falhou") {
      sacola = [];
      salvar();
      try { localStorage.removeItem("ffn-pedido"); } catch { /* ok */ }
    }
    $("#modalRetorno").showModal();
  }

  /* ---------- Início ---------- */
  $("#ano").textContent = new Date().getFullYear();
  montarChipsCategoria();
  renderVitrine();
  retornoPagamento();
  renderSacola();
})();
