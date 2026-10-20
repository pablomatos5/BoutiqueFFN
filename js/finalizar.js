/* Boutique FFN · página de finalizar: sacola, dados, entrega/frete e pagamento (Mercado Pago ou WhatsApp) */
(() => {
  const { brl, esc, semAcento, porId, linkWhats } = FFN;
  const $ = (sel) => document.querySelector(sel);
  const form = $("#checkout");

  let sacola = FFN.carregarSacola();
  // tipo: "retirada" | "gratis" (Cametá) | "correios" | "combinar" (API indisponível) | null (falta calcular)
  let frete = { tipo: "retirada", valor: 0 };
  let cotacao = null; // { cep, local, gratis? , opcoes? }

  const ehCameta = (local) => local.uf === "PA" && semAcento(local.localidade) === "cameta";

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
    const total = brl(sub + (frete.valor || 0));
    $("#sacolaTotal").textContent = total;
    $("#barraTotal").textContent = frete.tipo === "combinar" ? `${total} + frete` : total;
    $("#precoEntrega").textContent = { gratis: "Grátis", correios: brl(frete.valor || 0), combinar: "A combinar" }[frete.tipo] || "Calcular";
    atualizarEtapas();
  }

  function atualizarEtapas() {
    const entregaOk = !!form.nome.value.trim() && (form.entrega.value === "retirada" || (cotacao && form.rua.value.trim() && form.numero.value.trim()));
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

  // telefone com máscara (91) 98510-6107
  form.telefone.addEventListener("input", () => {
    const v = form.telefone.value.replace(/\D/g, "").slice(0, 11);
    form.telefone.value = v.length > 6 ? `(${v.slice(0, 2)}) ${v.slice(2, v.length - 4)}-${v.slice(-4)}` : v.length > 2 ? `(${v.slice(0, 2)}) ${v.slice(2)}` : v;
  });

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
    if (entrega) {
      if (!cotacao) return aviso("Informe o CEP para calcular o frete.", form.cep), null;
      if (!form.rua.value.trim()) return aviso("Informe a rua.", form.rua), null;
      if (!form.numero.value.trim()) return aviso("Informe o número.", form.numero), null;
    }
    aviso("");
    return {
      pedido: `FFN-${Date.now().toString(36).toUpperCase()}`,
      nome,
      telefone: form.telefone.value.trim(),
      entrega: entrega ? "entrega" : "retirada",
      cep: form.cep.value.replace(/\D/g, ""),
      servico: frete.tipo === "correios" ? frete.codigo : undefined,
      endereco: { rua: form.rua.value.trim(), numero: form.numero.value.trim(), complemento: form.complemento.value.trim(), bairro: form.bairro.value.trim() },
      itens: sacola.map(({ id, cor, tamanho, qtd }) => ({ id, cor, tamanho, qtd })),
    };
  }

  function mensagemPedido(d, pagamento) {
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
      freteTxt,
      `*Total: ${brl(sub + (frete.valor || 0))}*${frete.tipo === "combinar" ? " + frete" : ""}`,
      ``,
      `Nome: ${d.nome}`,
      d.telefone ? `WhatsApp: ${d.telefone}` : "",
      envio,
      `Pagamento: ${pagamento}`,
      form.obs.value.trim() ? `Obs.: ${form.obs.value.trim()}` : "",
    ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n").trim();
  }

  const botoesPagar = () => [$("#pagarMP"), $("#barraPagarBtn")];

  async function pagarMercadoPago(d) {
    botoesPagar().forEach((b) => { b.disabled = true; b.dataset.texto = b.textContent; b.textContent = "Abrindo…"; });
    try {
      const r = await fetch("api/pagamento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...d, obs: form.obs.value.trim() }) });
      const resp = await r.json().catch(() => ({}));
      if (!r.ok || !resp.url) throw new Error(resp.erro);
      try { localStorage.setItem("ffn-pedido", JSON.stringify({ pedido: d.pedido, msg: mensagemPedido(d, "Mercado Pago") })); } catch { /* segue sem guardar */ }
      location.href = resp.url;
    } catch (err) {
      $("#checkoutAviso").textContent = `${err.message || "Não foi possível abrir o pagamento agora"}. Você pode finalizar pelo WhatsApp logo abaixo.`;
      $("#checkoutAviso").scrollIntoView({ behavior: "smooth", block: "center" });
      botoesPagar().forEach((b) => { b.disabled = false; b.textContent = b.dataset.texto; });
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = dadosPedido();
    if (!d) return;
    if (e.submitter?.value === "whats") window.open(linkWhats(mensagemPedido(d, "a combinar")), "_blank", "noopener");
    else pagarMercadoPago(d);
  });

  // Na barra do celular: some quando o resumo (com o botão grande) está na tela
  const barra = $("#barraPagar");
  new IntersectionObserver(([e]) => barra.classList.toggle("is-escondida", e.isIntersecting), { threshold: 0.2 }).observe($(".resumo-pedido"));

  /* ---------- Volta do Mercado Pago ---------- */
  function retornoPagamento() {
    const q = new URLSearchParams(location.search);
    const status = q.get("pagamento");
    if (!status) return;
    history.replaceState(null, "", location.pathname);

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
      FFN.salvarSacola(sacola);
      try { localStorage.removeItem("ffn-pedido"); } catch { /* ok */ }
    }
    $("#modalRetorno").showModal();
    if (status === "aprovado") document.dispatchEvent(new CustomEvent("ffn:festa", { detail: { alvo: $("#modalRetorno img"), quantidade: 18 } }));
  }

  retornoPagamento();
  renderSacola();
  addEventListener("pageshow", (e) => { if (e.persisted) { sacola = FFN.carregarSacola(); renderSacola(); } });
})();
