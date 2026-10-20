/* Boutique FFN · página de finalizar: sacola, dados, entrega/frete e pagamento (aba própria em pagamento.js, ou WhatsApp) */
(() => {
  const { brl, esc, semAcento, porId, linkWhats } = FFN;
  const $ = (sel) => document.querySelector(sel);
  const form = $("#checkout");

  let sacola = FFN.carregarSacola();
  // tipo: "retirada" | "gratis" (Cametá) | "correios" | "combinar" (API indisponível) | null (falta calcular)
  let frete = { tipo: "retirada", valor: 0 };
  let cotacao = null; // { cep, local, gratis? , opcoes? }

  const ehCameta = (local) => local.uf === "PA" && semAcento(local.localidade) === "cameta";
  let cupom = null; // { codigo, desconto, descricao }
  const totalPedido = () => Math.max(0, FFN.totalSacola(sacola) - (cupom?.desconto || 0)) + (frete.valor || 0);
  let ultimoPedido = null; // dados do pedido enviado para pagamento (para a mensagem de confirmação)

  function cpfValido(cpf) {
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
    const dv = (n) => {
      let soma = 0;
      for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i);
      const r = (soma * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
  }

  /* ---------- Sacola ---------- */
  function renderSacola() {
    const vazia = sacola.length === 0;
    $("#finalizarVazio").hidden = !vazia;
    form.hidden = vazia;
    $(".passos-checkout").hidden = vazia;
    $("#barraPagar").hidden = vazia;
    const qtd = FFN.qtdSacola(sacola);
    $("#sacolaQtd").textContent = `${qtd} ${qtd === 1 ? "peça" : "peças"}`;
    $("#sacolaLista").innerHTML = FFN.htmlItens(sacola);
    sacolaMudou();
  }

  $("#sacolaLista").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b && FFN.editarItem(sacola, b)) {
      FFN.salvarSacola(sacola);
      renderSacola();
    }
  });

  /* ---------- Totais e etapas ---------- */
  function atualizarTotais() {
    const sub = FFN.totalSacola(sacola);
    $("#sacolaSubtotal").textContent = brl(sub);
    const rotulo = {
      retirada: "Grátis (retirada)",
      gratis: "Grátis (Cametá)",
      correios: frete.valor != null ? `${brl(frete.valor)} · ${frete.servico}` : "",
      combinar: "A combinar",
    }[frete.tipo] || "Informe o CEP";
    $("#sacolaFrete").textContent = rotulo;
    $("#linhaDesconto").hidden = !cupom;
    if (cupom) {
      $("#rotuloDesconto").textContent = `Cupom ${cupom.codigo}`;
      $("#sacolaDesconto").textContent = `− ${brl(cupom.desconto)}`;
    }
    const total = brl(totalPedido());
    $("#sacolaTotal").textContent = total;
    $("#barraTotal").textContent = frete.tipo === "combinar" ? `${total} + frete` : total;
    $("#precoEntrega").textContent = { gratis: "Grátis", correios: brl(frete.valor || 0), combinar: "A combinar" }[frete.tipo] || "Calcular";
    atualizarEtapas();
    atualizarBotoes();
    PagamentoFFN.totalMudou(totalPedido());
  }

  // texto dos botões de pagar conforme a aba (Pix ou cartão)
  function atualizarBotoes() {
    const total = brl(totalPedido());
    const pix = PagamentoFFN.metodo === "pix";
    $("#pagar").textContent = pix ? `${PagamentoFFN.pixAtivo ? "Gerar novo Pix" : "Gerar Pix"} · ${total}` : `Pagar ${total}`;
    $("#barraPagarBtn").textContent = pix ? "Gerar Pix" : "Pagar";
  }

  function atualizarEtapas() {
    const entregaOk = !!form.nome.value.trim() && /@/.test(form.email.value) && cpfValido(form.cpf.value.replace(/\D/g, "")) && (form.entrega.value === "retirada" || (cotacao && form.rua.value.trim() && form.numero.value.trim()));
    const estado = { sacola: sacola.length > 0, entrega: entregaOk };
    document.querySelectorAll(".passos-checkout li").forEach((li) => {
      const etapa = li.dataset.etapa;
      li.classList.toggle("is-feito", !!estado[etapa]);
      li.classList.toggle("is-atual", etapa === (!estado.sacola ? "sacola" : !estado.entrega ? "entrega" : "pagamento"));
    });
  }
  form.addEventListener("input", (e) => {
    e.target.classList?.remove("is-invalido");
    atualizarEtapas();
  });

  /* ---------- Entrega e frete ---------- */
  function statusFrete(texto, classe = "") {
    const el = $("#freteStatus");
    el.textContent = texto;
    el.className = `frete-status ${classe}`;
  }

  function definirEntrega() {
    const entrega = form.entrega.value === "entrega";
    $("#campoEndereco").hidden = !entrega;
    if (!entrega) frete = { tipo: "retirada", valor: 0 };
    else {
      aplicarCotacao();
      if (!cotacao) setTimeout(() => form.cep.focus(), 50);
    }
    atualizarTotais();
  }
  form.entrega.forEach((r) => r.addEventListener("change", definirEntrega));

  function aplicarCotacao() {
    $("#freteOpcoes").innerHTML = "";
    if (!cotacao) { frete = { tipo: null, valor: null }; return; }
    if (cotacao.gratis) {
      frete = { tipo: "gratis", valor: 0 };
      statusFrete("Entrega grátis em Cametá! 🐼", "is-gratis");
      document.dispatchEvent(new CustomEvent("ffn:festa", { detail: { alvo: $("#freteStatus") } }));
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
    frete = { tipo: "correios", valor: o.preco, servico: o.servico, codigo: o.codigo, prazo: o.prazo };
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
    statusFrete("O panda tá consultando o CEP…");

    let local = null;
    try {
      local = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
    } catch { /* ViaCEP fora do ar */ }
    if (!local || local.erro) {
      statusFrete("CEP não encontrado. Confira os números.", "is-erro");
      frete = { tipo: null, valor: null };
      atualizarTotais();
      return;
    }

    form.rua.value = local.logradouro || "";
    form.bairro.value = local.bairro || "";
    $("#enderecoCidade").textContent = `📍 ${local.localidade} - ${local.uf}`;
    $("#enderecoCampos").hidden = false;

    if (ehCameta(local)) {
      cotacao = { cep, local, gratis: true };
    } else {
      statusFrete("O panda tá calculando o frete nos Correios…");
      let opcoes = [];
      try {
        const r = await fetch(`api/frete?cep=${cep}&peso=${FFN.pesoSacola(sacola)}`);
        if (r.ok) opcoes = (await r.json()).opcoes || [];
      } catch { /* sem servidor (prévia estática): frete a combinar */ }
      cotacao = { cep, local, opcoes };
    }
    aplicarCotacao();
    atualizarTotais();
    (form.rua.value ? form.numero : form.rua).focus({ preventScroll: true });
  }

  $("#calcularFrete").addEventListener("click", calcularFrete);
  form.cep.addEventListener("input", () => {
    const v = form.cep.value.replace(/\D/g, "").slice(0, 8);
    form.cep.value = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
    if (v.length === 8 && v !== cotacao?.cep) calcularFrete();
  });
  form.cep.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); calcularFrete(); } });

  form.cpf.addEventListener("input", () => {
    const v = form.cpf.value.replace(/\D/g, "").slice(0, 11);
    form.cpf.value = v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  });

  // telefone com máscara (91) 98510-6107
  form.telefone.addEventListener("input", () => {
    const v = form.telefone.value.replace(/\D/g, "").slice(0, 11);
    form.telefone.value = v.length > 6 ? `(${v.slice(0, 2)}) ${v.slice(2, v.length - 4)}-${v.slice(-4)}` : v.length > 2 ? `(${v.slice(0, 2)}) ${v.slice(2)}` : v;
  });

  /* ---------- Cupom ---------- */
  // sem servidor (prévia): cupons de demonstração
  const CUPONS_DEMO = { FFN10: { tipo: "porcentagem", valor: 10 } };
  if (LOJA.campanha?.cupom) CUPONS_DEMO[LOJA.campanha.cupom.toUpperCase()] = { tipo: "porcentagem", valor: 10 };

  async function conferirCupom(codigo, { silencioso = false } = {}) {
    const status = (t, classe = "") => { $("#cupomStatus").textContent = t; $("#cupomStatus").className = `cupom__status ${classe}`; };
    codigo = String(codigo || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!codigo) { cupom = null; status(""); atualizarTotais(); return; }
    const sub = FFN.totalSacola(sacola);
    status("Conferindo o cupom…");
    try {
      let r;
      try {
        const resp = await fetch(`api/cupom?codigo=${encodeURIComponent(codigo)}&subtotal=${sub.toFixed(2)}`, { cache: "no-store" });
        if (resp.status === 503 || !resp.headers.get("content-type")?.includes("json")) throw new TypeError("sem servidor");
        r = await resp.json();
        if (!resp.ok) throw new Error(r.erro);
      } catch (e) {
        if (!(e instanceof TypeError)) throw e;
        const c = CUPONS_DEMO[codigo];
        if (!c) throw new Error("Cupom inválido (demonstração: use FFN10)");
        r = { codigo, desconto: Math.round(sub * c.valor) / 100, descricao: `${c.valor}% de desconto (demonstração)` };
      }
      cupom = r;
      status(`✓ ${r.descricao} aplicado`, "is-ok");
      if (!silencioso) document.dispatchEvent(new CustomEvent("ffn:festa", { detail: { alvo: $("#aplicarCupom"), quantidade: 8 } }));
    } catch (e) {
      cupom = null;
      status(e.message || "Não foi possível conferir agora", "is-erro");
    }
    atualizarTotais();
  }
  $("#aplicarCupom").addEventListener("click", () => conferirCupom($("#campoCupom").value));
  $("#campoCupom").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); conferirCupom($("#campoCupom").value); } });
  $("#campoCupom").addEventListener("input", () => { $("#campoCupom").value = $("#campoCupom").value.toUpperCase(); });

  // A sacola mudou: o peso mudou, então a cotação dos Correios precisa ser refeita
  function sacolaMudou() {
    if (cupom) conferirCupom(cupom.codigo, { silencioso: true }); // o desconto depende do subtotal
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

  /* ---------- Pedido ---------- */
  function dadosPedido() {
    const aviso = (t, campo) => {
      $("#checkoutAviso").textContent = t;
      if (campo) {
        campo.classList.add("is-invalido");
        campo.scrollIntoView({ behavior: "smooth", block: "center" });
        campo.focus({ preventScroll: true });
      }
    };
    form.querySelectorAll(".is-invalido").forEach((c) => c.classList.remove("is-invalido"));
    const nome = form.nome.value.trim();
    const entrega = form.entrega.value === "entrega";
    if (!nome) return aviso("Informe seu nome.", form.nome), null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim())) return aviso("Informe um e-mail válido.", form.email), null;
    if (!cpfValido(form.cpf.value.replace(/\D/g, ""))) return aviso("Informe um CPF válido.", form.cpf), null;
    if (entrega) {
      if (!cotacao) return aviso("Informe o CEP para calcular o frete.", form.cep), null;
      if (!form.rua.value.trim()) return aviso("Informe a rua.", form.rua), null;
      if (!form.numero.value.trim()) return aviso("Informe o número.", form.numero), null;
    }
    aviso("");
    return {
      pedido: `FFN-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      nome,
      telefone: form.telefone.value.trim(),
      email: form.email.value.trim(),
      cpf: form.cpf.value.replace(/\D/g, ""),
      obs: form.obs.value.trim(),
      cupom: cupom?.codigo || "",
      entrega: entrega ? "entrega" : "retirada",
      cep: form.cep.value.replace(/\D/g, ""),
      servico: frete.tipo === "correios" ? frete.codigo : undefined,
      endereco: { rua: form.rua.value.trim(), numero: form.numero.value.trim(), complemento: form.complemento.value.trim(), bairro: form.bairro.value.trim() },
      itens: sacola.map(({ id, cor, tamanho, qtd }) => ({ id, cor, tamanho, qtd })),
    };
  }

  function mensagemPedido(d, pagamento, link) {
    const linhas = sacola.map((i) => {
      const p = porId(i.id);
      return `• ${i.qtd}x ${p.nome} (${i.cor}, tam. ${i.tamanho}): ${brl(p.preco * i.qtd)}`;
    });
    const sub = FFN.totalSacola(sacola);
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
      cupom ? `Cupom ${cupom.codigo}: − ${brl(cupom.desconto)}` : "",
      freteTxt,
      `*Total: ${brl(totalPedido())}*${frete.tipo === "combinar" ? " + frete" : ""}`,
      ``,
      `Nome: ${d.nome}`,
      d.telefone ? `WhatsApp: ${d.telefone}` : "",
      envio,
      `Pagamento: ${pagamento}`,
      form.obs.value.trim() ? `Obs.: ${form.obs.value.trim()}` : "",
      link ? `` : "",
      link ? `Acompanhar pedido: ${link}` : "",
    ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n").trim();
  }

  const botoesPagar = () => [$("#pagar"), $("#barraPagarBtn")];

  async function pagar(d) {
    botoesPagar().forEach((b) => { b.disabled = true; b.classList.add("is-carregando"); });
    $("#checkoutAviso").textContent = "";
    ultimoPedido = d;
    try {
      await PagamentoFFN.pagar(d);
    } catch (err) {
      $("#checkoutAviso").textContent = `${err.message || "Não foi possível processar o pagamento agora"}. Se preferir, finalize pelo WhatsApp logo abaixo.`;
      $("#checkoutAviso").scrollIntoView({ behavior: "smooth", block: "center" });
    } finally {
      botoesPagar().forEach((b) => { b.disabled = false; b.classList.remove("is-carregando"); });
      atualizarBotoes();
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = dadosPedido();
    if (!d) return;
    if (e.submitter?.value === "whats") window.open(linkWhats(mensagemPedido(d, "a combinar")), "_blank", "noopener");
    else pagar(d);
  });

  // Modo demonstração: o pedido fica guardado no navegador para aparecer no acompanhamento e no painel
  function salvarPedidoDemo(d, r) {
    const agora = new Date().toISOString();
    const tipo = d.entrega === "retirada" ? "retirada" : frete.tipo === "gratis" ? "local" : "correios";
    FFN.demo.salvar({
      id: d.pedido, chave: "", criadoEm: agora, atualizadoEm: agora, status: "aprovado", demo: true,
      cliente: { nome: d.nome, email: d.email, cpf: d.cpf, telefone: d.telefone },
      entrega: {
        tipo,
        descricao: { retirada: "Retirada na loja", local: "Entrega grátis em Cametá", correios: `${frete.servico || "Correios"} para ${cotacao?.local?.localidade || ""}-${cotacao?.local?.uf || ""}` }[tipo],
        endereco: tipo === "retirada" ? "" : [[d.endereco.rua, d.endereco.numero].filter(Boolean).join(", "), d.endereco.complemento, d.endereco.bairro].filter(Boolean).join(" · "),
        cep: d.cep, cidade: cotacao?.local?.localidade || "Cametá", uf: cotacao?.local?.uf || "PA",
      },
      itens: sacola.map((i) => ({ nome: porId(i.id).nome, cor: i.cor, tamanho: i.tamanho, qtd: i.qtd, preco: porId(i.id).preco })),
      subtotal: FFN.totalSacola(sacola), desconto: cupom?.desconto || 0, cupom: cupom?.codigo || "", frete: frete.valor || 0, total: totalPedido(), obs: d.obs,
      pagamento: { metodo: r.metodo, status: "approved" },
      rastreio: "",
      historico: [{ status: "aguardando", em: agora }, { status: "aprovado", em: agora }],
    });
  }

  /* ---------- Pedido concluído ---------- */
  function concluido(r) {
    const d = ultimoPedido;
    const aprovado = r.status === "approved";
    const total = brl(totalPedido());
    $("#confTitulo").textContent = aprovado ? "Pedido confirmado! 🐼" : "Pagamento em análise";
    $("#confTexto").textContent = aprovado
      ? `Obrigado, ${d.nome.split(" ")[0]}! Recebemos seu pagamento. ${d.entrega === "retirada" ? "Avise a loja no WhatsApp para combinar a retirada." : "Avise a loja no WhatsApp para combinar a entrega."}`
      : "O Mercado Pago está analisando o pagamento. Você recebe a confirmação por e-mail, e a loja separa seu pedido assim que for aprovado.";
    $("#confPedido").textContent = r.pedido || d.pedido;
    $("#confPagamento").textContent = `${r.metodo}${aprovado ? " · aprovado" : " · em análise"}`;
    $("#confTotal").textContent = total;
    const situacao = `${r.metodo} ${aprovado ? "aprovado" : "em análise"}${r.id && r.id !== "DEMO" ? ` (ID ${r.id})` : ""}`;
    if (r.id === "DEMO") salvarPedidoDemo(d, r);
    const link = FFN.linkAcompanhar(r.pedido || d.pedido, r.chave);
    $("#confAcompanhar").href = link;
    $("#confWhats").href = linkWhats(mensagemPedido(d, situacao, link));
    try { localStorage.setItem("ffn-ultimo-pedido", JSON.stringify({ id: r.pedido || d.pedido, chave: r.chave || "" })); } catch { /* ok */ }

    form.hidden = true;
    $(".passos-checkout").querySelectorAll("li").forEach((li) => { li.classList.add("is-feito"); li.classList.remove("is-atual"); });
    $("#barraPagar").hidden = true;
    $(".finalizar__titulo").textContent = aprovado ? "Tudo certo!" : "Quase lá!";
    $(".voltar-loja").hidden = true;
    $("#confirmacao").hidden = false;
    sacola = [];
    FFN.salvarSacola(sacola);
    scrollTo({ top: 0, behavior: "smooth" });
    $("#confirmacao").focus({ preventScroll: true });
    if (aprovado) setTimeout(() => document.dispatchEvent(new CustomEvent("ffn:festa", { detail: { alvo: $("#confirmacao img"), quantidade: 20 } })), 350);
  }

  // Na barra do celular: some quando o resumo (com o botão grande) está na tela
  const barra = $("#barraPagar");
  new IntersectionObserver(([e]) => barra.classList.toggle("is-escondida", e.isIntersecting), { threshold: 0.2 }).observe($(".resumo-pedido"));

  PagamentoFFN.iniciar({ obterTotal: totalPedido, aoConcluir: concluido, aoMudarMetodo: atualizarBotoes });
  renderSacola();
  // cupom pelo link (?cupom=ROSA15) ou da campanha ativa
  const cupomLink = new URLSearchParams(location.search).get("cupom");
  if (cupomLink) {
    try { sessionStorage.setItem("ffn-cupom", cupomLink); } catch { /* ok */ }
  }
  let cupomGuardado = cupomLink;
  try { cupomGuardado ||= sessionStorage.getItem("ffn-cupom"); } catch { /* ok */ }
  if (cupomGuardado && sacola.length) {
    $("#caixaCupom").open = true;
    $("#campoCupom").value = cupomGuardado.toUpperCase();
    conferirCupom(cupomGuardado, { silencioso: true });
  } else if (LOJA.campanha?.cupom) {
    $("#cupomStatus").textContent = `Dica: use o cupom ${LOJA.campanha.cupom}`;
  }
  addEventListener("pageshow", (e) => { if (e.persisted) { sacola = FFN.carregarSacola(); renderSacola(); } });
})();
