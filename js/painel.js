/* Boutique FFN · painel da loja: pedidos pagos, status, código de rastreio e aviso ao cliente pelo WhatsApp */
(() => {
  const { brl, esc, dataHora, ETAPAS, nomeStatus, linkAcompanhar } = FFN;
  const $ = (sel) => document.querySelector(sel);
  const CHAVE_TOKEN = "ffn-painel-token";

  let token = null;
  let demo = false;
  let pedidos = [];
  let grupo = "fazer";
  let abertos = new Set();

  const GRUPOS = {
    fazer: ["aprovado", "separando"],
    caminho: ["enviado", "saiu", "pronto"],
    concluidos: ["entregue", "cancelado"],
    aguardando: ["aguardando"],
    todos: null,
  };
  const COR = { aguardando: "cinza", aprovado: "ouro", separando: "ouro", enviado: "azul", saiu: "azul", pronto: "azul", entregue: "verde", cancelado: "vermelho" };

  /* ---------- Comunicação ---------- */
  async function api(acao, { metodo = "GET", corpo, query = "" } = {}) {
    const r = await fetch(`api/painel?acao=${acao}${query}`, {
      method: metodo,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
      cache: "no-store",
    });
    if (r.status === 404 && !r.headers.get("content-type")?.includes("json")) throw Object.assign(new Error("sem servidor"), { semServidor: true });
    const dados = await r.json().catch(() => ({}));
    if (r.status === 401 && acao !== "entrar") { sair(); throw new Error("Sessão expirada. Entre novamente."); }
    if (r.status === 503) throw Object.assign(new Error(dados.erro), { semServidor: true });
    if (!r.ok) throw new Error(dados.erro || "Algo deu errado");
    return dados;
  }

  /* ---------- Entrar / sair ---------- */
  $("#formEntrar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const senha = e.target.senha.value;
    $("#entrarAviso").textContent = "";
    $("#entrar").classList.add("is-carregando");
    try {
      const r = await api("entrar", { metodo: "POST", corpo: { senha } });
      token = r.token;
      try { sessionStorage.setItem(CHAVE_TOKEN, JSON.stringify({ token, expira: r.expira })); } catch { /* ok */ }
      await abrirPainel();
    } catch (err) {
      if (err.semServidor || err instanceof TypeError) { demo = true; await abrirPainel(); }
      else $("#entrarAviso").textContent = err.message;
    } finally {
      $("#entrar").classList.remove("is-carregando");
    }
  });

  function sair() {
    token = null;
    try { sessionStorage.removeItem(CHAVE_TOKEN); } catch { /* ok */ }
    $("#conteudo").hidden = true;
    $("#sair").hidden = true;
    $("#formEntrar").hidden = false;
  }
  $("#sair").addEventListener("click", sair);

  async function abrirPainel() {
    $("#formEntrar").hidden = true;
    $("#conteudo").hidden = false;
    $("#sair").hidden = false;
    $("#demoAviso").hidden = !demo;
    await carregar();
  }

  /* ---------- Pedidos ---------- */
  async function carregar() {
    $("#recarregar").classList.add("is-carregando");
    try {
      if (demo) pedidos = pedidosDemo();
      else pedidos = (await api("pedidos")).pedidos;
      render();
    } catch (e) {
      mostrarToast("Não foi possível carregar", e.message);
    } finally {
      $("#recarregar").classList.remove("is-carregando");
    }
  }

  function pedidosDemo() {
    let lista = FFN.demo.listar();
    if (!lista.some((p) => p.id.startsWith("FFN-EXEMPLO"))) {
      const h = (d) => new Date(Date.now() - d * 3600_000).toISOString();
      const ex = (id, horas, status, tipo, nome, cidade, uf, itens, total, frete, rastreio = "") => ({
        id, chave: "", criadoEm: h(horas), atualizadoEm: h(horas), status, demo: true,
        cliente: { nome, email: "cliente@exemplo.com", cpf: "52998224725", telefone: "(91) 98510-6107" },
        entrega: { tipo, descricao: { retirada: "Retirada na loja", local: "Entrega grátis em Cametá", correios: `PAC para ${cidade}-${uf}` }[tipo], endereco: tipo === "retirada" ? "" : "Rua Exemplo, 100 · Centro", cep: "", cidade, uf },
        itens, subtotal: total - frete, frete, total, obs: "", pagamento: { metodo: "Pix", status: "approved" }, rastreio,
        historico: [{ status: "aguardando", em: h(horas) }, { status: "aprovado", em: h(horas) }, ...(status !== "aprovado" ? [{ status, em: h(horas / 2) }] : [])],
      });
      lista = [
        ex("FFN-EXEMPLO1", 2, "aprovado", "correios", "Mariana Lopes", "Belém", "PA", [{ nome: "Short Sarja Madrid", cor: "Marrom", tamanho: "G", qtd: 2, preco: 89.9 }], 212.2, 32.4),
        ex("FFN-EXEMPLO2", 5, "aprovado", "local", "João Pedro Costa", "Cametá", "PA", [{ nome: "Camiseta Básica Premium", cor: "Preto", tamanho: "M", qtd: 1, preco: 59.9 }], 59.9, 0),
        ex("FFN-EXEMPLO3", 30, "enviado", "correios", "Carla Mendes", "São Paulo", "SP", [{ nome: "Kit de Meias Lupo", cor: "Branco", tamanho: "39-43", qtd: 3, preco: 49.9 }], 182.1, 32.4, "AA123456789BR"),
        ex("FFN-EXEMPLO4", 50, "entregue", "retirada", "Rafael Souza", "Cametá", "PA", [{ nome: "Bermuda de Sarja", cor: "Bege", tamanho: "42", qtd: 1, preco: 109.9 }], 109.9, 0),
        ...lista,
      ];
      lista.forEach((p) => FFN.demo.salvar(p));
      lista = FFN.demo.listar();
    }
    return lista.sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm));
  }

  const filtrados = () => {
    const termo = FFN.semAcento($("#buscaPedido").value.trim());
    return pedidos.filter((p) => {
      if (GRUPOS[grupo] && !GRUPOS[grupo].includes(p.status)) return false;
      if (termo && !FFN.semAcento(`${p.id} ${p.cliente.nome} ${p.entrega.cidade} ${p.rastreio}`).includes(termo)) return false;
      return true;
    });
  };

  function proximaEtapa(p) {
    const etapas = ETAPAS[p.entrega.tipo] || ETAPAS.correios;
    const i = etapas.indexOf(p.status);
    if (i < 0 || i === etapas.length - 1) return null;
    const prox = etapas[i + 1];
    // Correios: "enviado" é marcado ao salvar o código de rastreio
    if (prox === "enviado") return null;
    return prox;
  }

  function render() {
    document.querySelectorAll("#abasStatus .aba-cat").forEach((a) => {
      const g = a.dataset.grupo;
      a.setAttribute("aria-selected", String(g === grupo));
      a.querySelector("span").textContent = pedidos.filter((p) => !GRUPOS[g] || GRUPOS[g].includes(p.status)).length;
    });
    const lista = filtrados();
    $("#semPedidos").hidden = lista.length > 0;
    $("#listaPedidos").innerHTML = lista.map(cartao).join("");
  }

  function cartao(p) {
    const novo = p.status === "aprovado" && Date.now() - Date.parse(p.criadoEm) < 24 * 3600_000;
    const prox = proximaEtapa(p);
    const precisaRastreio = p.entrega.tipo === "correios" && ["aprovado", "separando", "enviado", "saiu"].includes(p.status);
    const aberto = abertos.has(p.id);
    return `
    <li class="pedido-card" data-id="${esc(p.id)}">
      <button type="button" class="pedido-card__topo" data-acao="abrir" aria-expanded="${aberto}">
        <div>
          <strong>${esc(p.cliente.nome)}</strong>
          <small>${esc(p.id)} · ${dataHora(p.criadoEm)}</small>
        </div>
        <div class="pedido-card__lado">
          <span class="pill pill--${COR[p.status]}">${novo ? "🆕 " : ""}${esc(nomeStatus(p.entrega.tipo, p.status))}</span>
          <strong>${brl(p.total)}</strong>
        </div>
      </button>
      <p class="pedido-card__entrega">${{ retirada: "🏬", local: "🛵", correios: "📦" }[p.entrega.tipo] || ""} ${esc(p.entrega.descricao)}${p.rastreio ? ` · <code>${esc(p.rastreio)}</code>` : ""}</p>
      <div class="pedido-card__acoes">
        ${prox ? `<button type="button" class="btn btn--gold" data-acao="status" data-status="${prox}">Marcar: ${esc(nomeStatus(p.entrega.tipo, prox))}</button>` : ""}
        ${p.status !== "aguardando" && p.status !== "cancelado" ? `<button type="button" class="btn btn--whats" data-acao="avisar">Avisar no WhatsApp</button>` : ""}
      </div>
      ${precisaRastreio ? `
      <form class="pedido-card__rastreio" data-acao="rastreio">
        <label><span class="sr-only">Código de rastreio</span><input name="codigo" value="${esc(p.rastreio)}" placeholder="AB123456789BR" autocapitalize="characters" autocomplete="off" maxlength="13"></label>
        <button type="submit" class="btn btn--ghost-escuro">${p.rastreio ? "Trocar" : "Salvar código"}</button>
      </form>` : ""}
      <div class="pedido-card__detalhes" ${aberto ? "" : "hidden"}>
        <ul class="itens-resumo">${p.itens.map((i) => `<li><span>${i.qtd}x ${esc(i.nome)}</span><small>${esc(i.cor)} · Tam. ${esc(i.tamanho)} · ${brl(i.preco * i.qtd)}</small></li>`).join("")}</ul>
        <dl class="pedido-card__dados">
          <div><dt>Frete</dt><dd>${p.frete ? brl(p.frete) : "Grátis"}</dd></div>
          ${p.cupom ? `<div><dt>Cupom</dt><dd>${esc(p.cupom)} · − ${brl(p.desconto || 0)}</dd></div>` : ""}
          <div><dt>Pagamento</dt><dd>${esc(p.pagamento?.metodo || "")}${p.pagamento?.parcelas > 1 ? ` em ${p.pagamento.parcelas}x` : ""}</dd></div>
          <div><dt>WhatsApp</dt><dd>${p.cliente.telefone ? `<a href="https://wa.me/55${p.cliente.telefone.replace(/\D/g, "")}" target="_blank" rel="noopener">${esc(p.cliente.telefone)}</a>` : "—"}</dd></div>
          <div><dt>E-mail</dt><dd>${esc(p.cliente.email)}</dd></div>
          <div><dt>CPF</dt><dd>${esc(p.cliente.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"))}</dd></div>
          ${p.entrega.endereco ? `<div><dt>Endereço</dt><dd>${esc(p.entrega.endereco)}<br>${esc(p.entrega.cidade)}-${esc(p.entrega.uf)}${p.entrega.cep ? ` · CEP ${esc(p.entrega.cep)}` : ""}</dd></div>` : ""}
          ${p.obs ? `<div><dt>Obs.</dt><dd>${esc(p.obs)}</dd></div>` : ""}
        </dl>
        <div class="pedido-card__extra">
          <button type="button" class="link-whats" data-acao="copiar-link">Copiar link de acompanhamento</button>
          <label class="pedido-card__corrigir">Corrigir status
            <select data-acao="corrigir">
              ${["aguardando", ...(ETAPAS[p.entrega.tipo] || ETAPAS.correios), "cancelado"].map((s) => `<option value="${s}" ${s === p.status ? "selected" : ""}>${esc(nomeStatus(p.entrega.tipo, s))}</option>`).join("")}
            </select>
          </label>
        </div>
        <ol class="pedido-card__historico">${p.historico.slice().reverse().map((h) => `<li>${esc(nomeStatus(p.entrega.tipo, h.status))} · ${dataHora(h.em)}${h.nota ? ` · ${esc(h.nota)}` : ""}</li>`).join("")}</ol>
      </div>
    </li>`;
  }

  /* ---------- Ações ---------- */
  async function atualizar(id, mudancas) {
    if (demo) {
      const p = FFN.demo.obter(id);
      if (mudancas.rastreio !== undefined) {
        const codigo = mudancas.rastreio.toUpperCase().replace(/\s/g, "");
        if (codigo && !/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(codigo)) throw new Error("Código de rastreio inválido (ex.: AB123456789BR)");
        p.rastreio = codigo;
        if (codigo && ["aprovado", "separando"].includes(p.status)) FFN.demo.mudarStatus(p, "enviado", `Código de rastreio ${codigo}`);
      }
      if (mudancas.status) FFN.demo.mudarStatus(p, mudancas.status);
      FFN.demo.salvar(p);
      return p;
    }
    return (await api("atualizar", { metodo: "POST", corpo: { id, ...mudancas } })).pedido;
  }

  function substituir(p) {
    pedidos = pedidos.map((x) => (x.id === p.id ? p : x));
    render();
  }

  function mensagemCliente(p) {
    const nome = p.cliente.nome.split(" ")[0];
    const link = linkAcompanhar(p.id, p.chave);
    const textos = {
      aprovado: `Olá, ${nome}! Aqui é da Boutique FFN 🐼 Recebemos o pagamento do seu pedido ${p.id}. Já já começamos a separar suas peças!`,
      separando: `Olá, ${nome}! Seu pedido ${p.id} está sendo separado e embalado com carinho aqui na Boutique FFN 🐼`,
      enviado: `Olá, ${nome}! Seu pedido ${p.id} foi enviado pelos Correios 📦\nCódigo de rastreio: ${p.rastreio}`,
      saiu: `Olá, ${nome}! Seu pedido ${p.id} saiu para entrega hoje 🛵`,
      pronto: `Olá, ${nome}! Seu pedido ${p.id} está pronto para retirar na Boutique FFN: Rua 13 de Maio, Centro, em frente ao Hotel Aricurá 🏬`,
      entregue: `Olá, ${nome}! Seu pedido ${p.id} foi entregue. Obrigado por comprar na Boutique FFN. Fica feio nunca! 🐼`,
    };
    return `${textos[p.status] || `Olá, ${nome}! Sobre o seu pedido ${p.id} na Boutique FFN:`}\n\nAcompanhe aqui: ${link}`;
  }

  $("#listaPedidos").addEventListener("click", async (e) => {
    const alvo = e.target.closest("[data-acao]");
    if (!alvo || alvo.tagName === "FORM" || alvo.tagName === "SELECT") return;
    const id = alvo.closest(".pedido-card").dataset.id;
    const p = pedidos.find((x) => x.id === id);
    const acao = alvo.dataset.acao;

    if (acao === "abrir") {
      abertos.has(id) ? abertos.delete(id) : abertos.add(id);
      const card = alvo.closest(".pedido-card");
      card.querySelector(".pedido-card__detalhes").hidden = !abertos.has(id);
      alvo.setAttribute("aria-expanded", String(abertos.has(id)));
      return;
    }
    if (acao === "avisar") {
      const tel = p.cliente.telefone.replace(/\D/g, "");
      const url = `https://wa.me/${tel ? `55${tel}` : ""}?text=${encodeURIComponent(mensagemCliente(p))}`;
      window.open(url, "_blank", "noopener");
      return;
    }
    if (acao === "copiar-link") {
      try { await navigator.clipboard.writeText(linkAcompanhar(p.id, p.chave)); } catch { /* sem permissão */ }
      mostrarToast("Link copiado!", p.id);
      return;
    }
    if (acao === "status") {
      alvo.classList.add("is-carregando");
      try {
        substituir(await atualizar(id, { status: alvo.dataset.status }));
        mostrarToast("Status atualizado!", `${p.id} · lembre de avisar o cliente`);
      } catch (err) {
        mostrarToast("Não foi possível salvar", err.message);
        alvo.classList.remove("is-carregando");
      }
    }
  });

  $("#listaPedidos").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = e.target.closest(".pedido-card").dataset.id;
    const botao = e.target.querySelector("button");
    botao.classList.add("is-carregando");
    try {
      const p = await atualizar(id, { rastreio: e.target.codigo.value });
      substituir(p);
      mostrarToast("Código salvo!", "Agora toque em “Avisar no WhatsApp”");
    } catch (err) {
      mostrarToast("Não foi possível salvar", err.message);
      botao.classList.remove("is-carregando");
    }
  });

  $("#listaPedidos").addEventListener("change", async (e) => {
    if (e.target.dataset.acao !== "corrigir") return;
    const id = e.target.closest(".pedido-card").dataset.id;
    try {
      substituir(await atualizar(id, { status: e.target.value }));
      mostrarToast("Status corrigido!", id);
    } catch (err) {
      mostrarToast("Não foi possível salvar", err.message);
    }
  });

  $("#abasStatus").addEventListener("click", (e) => {
    const a = e.target.closest("[data-grupo]");
    if (!a) return;
    grupo = a.dataset.grupo;
    render();
  });
  let espera;
  $("#buscaPedido").addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(render, 120); });
  $("#recarregar").addEventListener("click", () => (secao === "cupons" ? carregarCupons() : carregar()));

  // busca pedidos novos a cada minuto enquanto o painel está aberto
  setInterval(() => { if (!$("#conteudo").hidden && !document.hidden) carregar(); }, 60_000);

  /* ---------- Seções: pedidos e cupons ---------- */
  let secao = "pedidos";
  let cupons = [];
  document.querySelector(".painel__secoes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-secao]");
    if (!b) return;
    secao = b.dataset.secao;
    document.querySelectorAll(".painel__secoes [data-secao]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    $("#secaoPedidos").hidden = secao !== "pedidos";
    $("#secaoCupons").hidden = secao !== "cupons";
    if (secao === "cupons") carregarCupons();
  });

  /* ---------- Cupons ---------- */
  const CHAVE_CUPONS_DEMO = "ffn-cupons-demo";
  const cuponsDemo = {
    ler() { try { return JSON.parse(localStorage.getItem(CHAVE_CUPONS_DEMO)) || [{ codigo: "FFN10", tipo: "porcentagem", valor: 10, ate: "", limite: 0, minimo: 0, ativo: true, usos: 3 }]; } catch { return []; } },
    gravar(l) { try { localStorage.setItem(CHAVE_CUPONS_DEMO, JSON.stringify(l)); } catch { /* ok */ } },
  };

  async function carregarCupons() {
    try {
      cupons = demo ? cuponsDemo.ler() : (await api("cupons")).cupons;
      renderCupons();
    } catch (e) {
      mostrarToast("Não foi possível carregar os cupons", e.message);
    }
  }

  function renderCupons() {
    $("#exemploLinkCupom").textContent = new URL(`index.html?cupom=${cupons[0]?.codigo || "CODIGO"}`, location.href).href;
    $("#semCupons").hidden = cupons.length > 0;
    $("#listaCupons").innerHTML = cupons
      .map((c) => {
        const expirado = c.ate && new Date(`${c.ate}T23:59:59-03:00`) < new Date();
        const esgotado = c.limite && c.usos >= c.limite;
        const situacao = !c.ativo ? ["Pausado", "cinza"] : expirado ? ["Expirado", "vermelho"] : esgotado ? ["Esgotado", "vermelho"] : ["Ativo", "verde"];
        return `<li class="pedido-card cupom-card" data-codigo="${esc(c.codigo)}">
          <div class="pedido-card__topo">
            <div><strong class="cupom-card__codigo">${esc(c.codigo)}</strong>
              <small>${c.tipo === "valor" ? `${brl(c.valor)} de desconto` : `${c.valor}% de desconto`}${c.minimo ? ` · mínimo ${brl(c.minimo)}` : ""}${c.ate ? ` · até ${c.ate.split("-").reverse().join("/")}` : ""}</small></div>
            <div class="pedido-card__lado"><span class="pill pill--${situacao[1]}">${situacao[0]}</span><small>${c.usos || 0}${c.limite ? `/${c.limite}` : ""} usos</small></div>
          </div>
          <div class="pedido-card__acoes">
            <button type="button" class="btn btn--ghost-escuro" data-cupom="alternar">${c.ativo ? "Pausar" : "Ativar"}</button>
            <button type="button" class="btn btn--ghost-escuro" data-cupom="link">Copiar link</button>
            <button type="button" class="btn btn--ghost-escuro btn--perigo" data-cupom="apagar">Apagar</button>
          </div>
        </li>`;
      })
      .join("");
  }

  async function salvarCupom(c) {
    if (demo) {
      const lista = cuponsDemo.ler().filter((x) => x.codigo !== c.codigo);
      const antigo = cuponsDemo.ler().find((x) => x.codigo === c.codigo);
      cuponsDemo.gravar([{ ...c, usos: antigo?.usos || 0 }, ...lista]);
      return;
    }
    await api("salvarCupom", { metodo: "POST", corpo: c });
  }

  $("#formCupom").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const c = {
      codigo: f.codigo.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""),
      tipo: f.tipo.value,
      valor: Number(f.valor.value),
      ate: f.ate.value,
      limite: Number(f.limite.value) || 0,
      minimo: Number(f.minimo.value) || 0,
      ativo: true,
    };
    $("#cupomAviso").textContent = "";
    if (c.codigo.length < 3) return ($("#cupomAviso").textContent = "O código precisa ter pelo menos 3 letras ou números.");
    if (!(c.valor > 0) || (c.tipo === "porcentagem" && c.valor > 90)) return ($("#cupomAviso").textContent = "Desconto inválido (porcentagem até 90%).");
    try {
      await salvarCupom(c);
      f.reset();
      mostrarToast("Cupom salvo!", c.codigo);
      carregarCupons();
    } catch (err) {
      $("#cupomAviso").textContent = err.message;
    }
  });
  $("#formCupom").codigo.addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase(); });

  $("#listaCupons").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-cupom]");
    if (!b) return;
    const codigo = b.closest(".cupom-card").dataset.codigo;
    const c = cupons.find((x) => x.codigo === codigo);
    try {
      if (b.dataset.cupom === "alternar") await salvarCupom({ ...c, ativo: !c.ativo });
      if (b.dataset.cupom === "link") {
        try { await navigator.clipboard.writeText(new URL(`index.html?cupom=${codigo}`, location.href).href); } catch { /* ok */ }
        return mostrarToast("Link copiado!", "Cole no Instagram ou no WhatsApp");
      }
      if (b.dataset.cupom === "apagar") {
        if (!confirm(`Apagar o cupom ${codigo}?`)) return;
        if (demo) cuponsDemo.gravar(cuponsDemo.ler().filter((x) => x.codigo !== codigo));
        else await api("apagarCupom", { metodo: "POST", corpo: { codigo } });
      }
      carregarCupons();
    } catch (err) {
      mostrarToast("Não foi possível salvar", err.message);
    }
  });

  /* ---------- Aviso ---------- */
  let timer;
  function mostrarToast(titulo, texto = "") {
    $("#toastTitulo").textContent = titulo;
    $("#toastNome").textContent = texto;
    $("#toast").hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => ($("#toast").hidden = true), 3200);
  }

  /* ---------- Início: sessão salva ---------- */
  try {
    const salvo = JSON.parse(sessionStorage.getItem(CHAVE_TOKEN));
    if (salvo?.token && salvo.expira > Date.now()) { token = salvo.token; abrirPainel(); }
  } catch { /* sem sessão */ }
})();
