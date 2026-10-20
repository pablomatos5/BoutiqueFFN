/* Boutique FFN · acompanhar pedido: busca por número + CPF (ou link com chave), linha do tempo e rastreio */
(() => {
  const { brl, esc, dataHora, linkWhats } = FFN;
  const $ = (sel) => document.querySelector(sel);
  const form = $("#formBusca");
  let atual = null; // { id, chave, cpf }
  let modoDemo = false;

  const ICONES = { aprovado: "💳", separando: "📦", enviado: "🚚", saiu: "🛵", pronto: "🏬", entregue: "🎉", aguardando: "⏳", cancelado: "✖️" };
  const SUB = {
    aguardando: "Assim que o pagamento for confirmado, a loja começa a separar.",
    aprovado: "Recebemos seu pagamento. Logo a loja começa a separar suas peças.",
    separando: "Suas peças estão sendo separadas e embaladas com carinho.",
    enviado: "Seu pedido está a caminho pelos Correios.",
    saiu: "Hoje é o dia! Seu pedido saiu para entrega.",
    pronto: "Pode vir buscar na Rua 13 de Maio, em frente ao Hotel Aricurá.",
    entregue: "Pedido entregue. Fica feio nunca! 🐼",
    cancelado: "O pagamento não foi concluído. Fale com a loja se precisar de ajuda.",
  };

  /* ---------- Busca ---------- */
  async function buscar({ id, chave, cpf }) {
    $("#buscaAviso").textContent = "";
    $("#buscar").classList.add("is-carregando");
    try {
      let r = null;
      if (!modoDemo) {
        try {
          const resp = chave
            ? await fetch(`api/pedido?pedido=${encodeURIComponent(id)}&chave=${encodeURIComponent(chave)}`, { cache: "no-store" })
            : await fetch("api/pedido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedido: id, cpf }) });
          if (resp.status === 503 || resp.status === 404 && !resp.headers.get("content-type")?.includes("json")) modoDemo = true;
          else {
            const dados = await resp.json();
            if (!resp.ok) throw new Error(dados.erro);
            r = dados;
          }
        } catch (e) {
          if (e instanceof TypeError) modoDemo = true; // sem servidor (prévia estática)
          else throw e;
        }
      }
      if (modoDemo) r = buscarDemo(id, cpf);
      atual = { id: r.pedido.id, chave: r.chave || chave, cpf };
      mostrar(r);
      const url = new URL(location.href);
      url.search = atual.chave ? `?pedido=${atual.id}&chave=${atual.chave}` : `?pedido=${atual.id}`;
      history.replaceState(null, "", url);
    } catch (e) {
      $("#buscaAviso").textContent = e.message || "Não foi possível consultar agora. Tente de novo em instantes.";
      form.hidden = false;
      $("#resultado").hidden = true;
    } finally {
      $("#buscar").classList.remove("is-carregando");
    }
  }

  function buscarDemo(id, cpf) {
    $("#demoAviso").hidden = false;
    const local = FFN.demo.obter(id);
    if (local) return { pedido: FFN.demo.publico(local), rastreio: local.rastreio ? rastreioDemo(local.rastreio, local.status) : null };
    if (id === "FFN-DEMO2026" || !id) return exemploDemo();
    throw new Error("Não encontramos esse pedido. Confira o número e o CPF. (Modo demonstração: tente FFN-DEMO2026.)");
  }

  function rastreioDemo(codigo, status) {
    const h = (d) => new Date(Date.now() - d * 3600_000).toISOString();
    const eventos = [
      { em: h(30), descricao: "Objeto postado", local: "CAMETA - PA" },
      { em: h(18), descricao: "Objeto em transferência - por favor aguarde", local: "BELEM - PA" },
    ];
    if (status === "saiu" || status === "entregue") eventos.push({ em: h(3), descricao: "Objeto saiu para entrega ao destinatário", local: "SAO PAULO - SP" });
    if (status === "entregue") eventos.push({ em: h(1), descricao: "Objeto entregue ao destinatário", local: "SAO PAULO - SP" });
    return { codigo, eventos: eventos.reverse() };
  }

  function exemploDemo() {
    const h = (d) => new Date(Date.now() - d * 3600_000).toISOString();
    const p = {
      id: "FFN-DEMO2026", criadoEm: h(52), status: "enviado", cliente: { nome: "Cliente Exemplo" },
      entrega: { tipo: "correios", descricao: "PAC para São Paulo-SP", cidade: "São Paulo", uf: "SP" },
      itens: [{ nome: "Short Sarja Madrid", cor: "Preto", tamanho: "M", qtd: 1 }, { nome: "Kit de Meias Lupo", cor: "Branco", tamanho: "39-43", qtd: 2 }],
      total: 222.1, frete: 32.4, pagamento: { metodo: "Pix" }, rastreio: "AA123456789BR",
      historico: [{ status: "aguardando", em: h(52) }, { status: "aprovado", em: h(52) }, { status: "separando", em: h(40) }, { status: "enviado", em: h(30) }],
    };
    return { pedido: FFN.demo.publico(p), rastreio: rastreioDemo(p.rastreio, p.status) };
  }

  /* ---------- Tela ---------- */
  function mostrar({ pedido: p, rastreio }) {
    form.hidden = true;
    $("#resultado").hidden = false;
    $("#rPedido").textContent = `Pedido ${p.id} · feito em ${dataHora(p.criadoEm)}`;
    $("#rStatus").textContent = `${ICONES[p.status] || ""} ${p.nomeStatus}`;
    $("#rSub").textContent = SUB[p.status] || "";
    $("#statusAtual").dataset.status = p.status;

    const feitas = p.etapas.filter((e) => e.em).length;
    $("#linhaTempo").innerHTML = p.etapas
      .map((e, i) => {
        const classe = e.em ? (i === feitas - 1 && p.status !== "entregue" ? "is-atual" : "is-feita") : "";
        return `<li class="${classe}"><span class="linha-tempo__gomo">${e.em ? "✓" : i + 1}</span>
          <div><strong>${esc(e.nome)}</strong><small>${e.em ? dataHora(e.em) : "Em breve"}</small></div></li>`;
      })
      .join("");
    if (p.status === "cancelado") $("#linhaTempo").innerHTML = `<li class="is-cancelado"><span class="linha-tempo__gomo">✖</span><div><strong>Pedido cancelado</strong><small>${esc(SUB.cancelado)}</small></div></li>`;

    $("#cardRastreio").hidden = !p.rastreio;
    if (p.rastreio) {
      $("#rCodigo").textContent = p.rastreio;
      const eventos = rastreio?.eventos || [];
      $("#eventos").innerHTML = eventos.length
        ? eventos.map((e) => `<li><strong>${esc(e.descricao)}</strong><small>${dataHora(e.em)}${e.local ? ` · ${esc(e.local)}` : ""}</small></li>`).join("")
        : `<li class="eventos__vazio">Os Correios ainda não registraram movimentações. Costuma aparecer em até 24 h após a postagem.</li>`;
    }

    $("#rEntrega").textContent = p.entrega.descricao;
    $("#rItens").innerHTML = p.itens.map((i) => `<li><span>${i.qtd}x ${esc(i.nome)}</span><small>${esc(i.cor)} · Tam. ${esc(i.tamanho)}</small></li>`).join("");
    $("#rTotal").textContent = brl(p.total);
    $("#rWhats").href = linkWhats(`Olá, Boutique FFN! Tenho uma dúvida sobre o pedido ${p.id}.`);

    if (p.status === "entregue") document.dispatchEvent(new CustomEvent("ffn:festa", { detail: { alvo: $(".status-atual__panda"), quantidade: 16 } }));
  }

  /* ---------- Eventos ---------- */
  form.cpf.addEventListener("input", () => {
    const v = form.cpf.value.replace(/\D/g, "").slice(0, 11);
    form.cpf.value = v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  });
  form.pedido.addEventListener("input", () => { form.pedido.value = form.pedido.value.toUpperCase(); });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = form.pedido.value.trim().toUpperCase();
    const cpf = form.cpf.value.replace(/\D/g, "");
    if (!/^FFN-[A-Z0-9]{4,}$/.test(id)) { $("#buscaAviso").textContent = "Digite o número do pedido, no formato FFN-XXXXXXXX."; form.pedido.focus(); return; }
    if (cpf.length !== 11) { $("#buscaAviso").textContent = "Digite os 11 números do CPF."; form.cpf.focus(); return; }
    buscar({ id, cpf });
  });

  $("#atualizar").addEventListener("click", () => atual && buscar(atual));
  $("#outroPedido").addEventListener("click", () => {
    atual = null;
    $("#resultado").hidden = true;
    form.hidden = false;
    form.reset();
    history.replaceState(null, "", location.pathname);
    form.pedido.focus();
  });
  $("#copiarCodigo").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#rCodigo").textContent); } catch { /* sem permissão */ }
    $("#copiarCodigo").textContent = "Copiado ✓";
    setTimeout(() => ($("#copiarCodigo").textContent = "Copiar"), 2000);
  });

  let ultimo = null;
  try { ultimo = JSON.parse(localStorage.getItem("ffn-ultimo-pedido")); } catch { /* sem dados */ }
  if (ultimo?.id) {
    $("#ultimoPedido").hidden = false;
    $("#ultimoPedido").addEventListener("click", () => buscar({ id: ultimo.id, chave: ultimo.chave }));
  }

  // atualiza sozinho a cada 2 minutos enquanto a página está aberta
  setInterval(() => { if (atual && !document.hidden) buscar(atual); }, 120_000);

  const q = new URLSearchParams(location.search);
  if (q.get("pedido")) buscar({ id: q.get("pedido").toUpperCase(), chave: q.get("chave") || "" });
})();
