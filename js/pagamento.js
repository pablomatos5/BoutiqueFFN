/*
 * Boutique FFN · aba de pagamento dentro do site (Checkout Transparente do Mercado Pago)
 *
 * Modo real: /api/config devolve a Public Key → carrega o SDK do Mercado Pago, monta os campos
 * seguros do cartão (iframes do Mercado Pago, com o visual da loja) e cobra via /api/pagamento.
 * Modo demonstração: sem servidor ou sem credenciais → mesma tela, com campos comuns e respostas
 * simuladas. Nada é enviado a lugar nenhum.
 */
window.PagamentoFFN = (() => {
  const { brl } = FFN;
  const $ = (sel) => document.querySelector(sel);

  let metodo = "pix";
  let modo = "carregando"; // "real" | "demo"
  let mp = null;
  const campos = {};
  let cartao = { bin: "", paymentMethodId: "", issuerId: "", tipo: "credit_card", bandeira: "" };
  let pix = null; // { id, total, expira, timer, consulta }
  let opcoes = { obterTotal: () => 0, aoConcluir: () => {}, aoMudarMetodo: () => {} };

  const novaChave = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const carregarScript = (src, extra = {}) =>
    new Promise((ok, erro) => {
      const s = Object.assign(document.createElement("script"), { src, async: true, onload: ok, onerror: erro });
      Object.entries(extra).forEach(([k, v]) => s.setAttribute(k, v));
      document.head.appendChild(s);
    });

  /* ---------- Abas ---------- */
  function escolherMetodo(novo, foco = false) {
    metodo = novo;
    document.querySelectorAll(".abas-pag [role=tab]").forEach((aba) => {
      const ativa = aba.dataset.metodo === novo;
      aba.setAttribute("aria-selected", String(ativa));
      aba.tabIndex = ativa ? 0 : -1;
      if (ativa && foco) aba.focus();
    });
    $("#painelPix").hidden = novo !== "pix";
    $("#painelCartao").hidden = novo !== "cartao";
    opcoes.aoMudarMetodo(novo);
  }

  function ligarAbas() {
    const abas = [...document.querySelectorAll(".abas-pag [role=tab]")];
    abas.forEach((aba, i) => {
      aba.addEventListener("click", () => escolherMetodo(aba.dataset.metodo));
      aba.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const prox = abas[(i + (e.key === "ArrowRight" ? 1 : abas.length - 1)) % abas.length];
        escolherMetodo(prox.dataset.metodo, true);
      });
    });
  }

  /* ---------- Cartão: visual ---------- */
  function atualizarVisual({ numero, nome, validade } = {}) {
    if (numero !== undefined) {
      const d = numero.replace(/\D/g, "").padEnd(16, "•");
      $("#cvNumero").textContent = d.replace(/(.{4})/g, "$1 ").trim();
    }
    if (nome !== undefined) $("#cvNome").textContent = nome.trim().toUpperCase() || "NOME NO CARTÃO";
    if (validade !== undefined) $("#cvValidade").textContent = validade || "MM/AA";
  }
  function mostrarBandeira(nome) {
    cartao.bandeira = nome || "";
    $("#cvBandeira").textContent = nome || "";
    $("#cartaoVisual").dataset.bandeira = (nome || "").toLowerCase();
  }

  function preencherParcelas(lista) {
    const sel = $("#parcelas");
    sel.innerHTML = lista.length
      ? lista.map((p) => `<option value="${Number(p.n)}">${FFN.esc(p.texto)}</option>`).join("")
      : `<option value="">Digite o número do cartão</option>`;
  }

  /* ---------- Modo real (Mercado Pago) ---------- */
  async function iniciarReal(publicKey) {
    await carregarScript("https://sdk.mercadopago.com/js/v2");
    // identificação do aparelho, que o Mercado Pago usa na análise antifraude
    carregarScript("https://www.mercadopago.com/v2/security.js", { view: "checkout" }).catch(() => {});
    mp = new MercadoPago(publicKey, { locale: "pt-BR" });

    const estilo = { style: { fontSize: "16px", fontFamily: "Montserrat, system-ui, sans-serif", color: "#141a17", placeholderColor: "#8b938f" } };
    campos.numero = mp.fields.create("cardNumber", { placeholder: "0000 0000 0000 0000", ...estilo }).mount("mpNumero");
    campos.validade = mp.fields.create("expirationDate", { placeholder: "MM/AA", ...estilo }).mount("mpValidade");
    campos.cvv = mp.fields.create("securityCode", { placeholder: "123", ...estilo }).mount("mpCvv");

    for (const [nome, campo] of Object.entries(campos)) {
      const caixa = $({ numero: "#mpNumero", validade: "#mpValidade", cvv: "#mpCvv" }[nome]);
      campo.on("focus", () => caixa.classList.add("is-foco"));
      campo.on("blur", () => caixa.classList.remove("is-foco"));
      campo.on("validityChange", (e) => caixa.classList.toggle("is-invalido", (e.errorMessages || []).length > 0));
    }
    campos.numero.on("binChange", ({ bin }) => aoMudarBin(bin || ""));
    // os iframes não deixam ler o número: o cartão desenhado mostra só a bandeira e os primeiros dígitos
    campos.numero.on("binChange", ({ bin }) => atualizarVisual({ numero: bin || "" }));
  }

  async function aoMudarBin(bin) {
    if (bin === cartao.bin) return;
    cartao.bin = bin;
    if (!bin) {
      cartao = { ...cartao, paymentMethodId: "", issuerId: "" };
      mostrarBandeira("");
      preencherParcelas([]);
      return;
    }
    try {
      const { results } = await mp.getPaymentMethods({ bin });
      const pm = results?.[0];
      if (!pm) throw new Error("bandeira");
      cartao.paymentMethodId = pm.id;
      cartao.tipo = pm.payment_type_id;
      mostrarBandeira(pm.name);
      const regra = pm.settings?.[0];
      if (regra) {
        campos.numero.update({ settings: regra.card_number });
        campos.cvv.update({ settings: regra.security_code });
      }
      if (pm.additional_info_needed?.includes("issuer_id")) {
        const emissores = await mp.getIssuers({ paymentMethodId: pm.id, bin });
        cartao.issuerId = emissores?.[0]?.id || "";
      } else {
        cartao.issuerId = pm.issuer?.id || "";
      }
      await carregarParcelas();
    } catch {
      $("#cartaoAviso").textContent = "Não reconhecemos esse cartão. Confira o número.";
    }
  }

  async function carregarParcelas() {
    const total = opcoes.obterTotal();
    if (modo === "demo") return preencherParcelas(parcelasDemo(total));
    if (!cartao.bin || !total) return preencherParcelas([]);
    if (cartao.tipo !== "credit_card") return preencherParcelas([{ n: 1, texto: `Débito à vista · ${brl(total)}` }]);
    try {
      const [r] = await mp.getInstallments({ amount: total.toFixed(2), bin: cartao.bin, paymentTypeId: "credit_card" });
      preencherParcelas((r?.payer_costs || []).map((c) => ({ n: c.installments, texto: c.recommended_message })));
    } catch {
      preencherParcelas([{ n: 1, texto: `1x de ${brl(total)}` }]);
    }
  }

  /* ---------- Modo demonstração ---------- */
  function iniciarDemo() {
    $("#demoAviso").hidden = false;
    const criar = (id, attrs) => {
      const input = Object.assign(document.createElement("input"), { className: "campo-seguro__input", autocomplete: "off", ...attrs });
      input.setAttribute("aria-labelledby", $(`#${id}`).getAttribute("aria-labelledby"));
      $(`#${id}`).appendChild(input);
      input.addEventListener("focus", () => $(`#${id}`).classList.add("is-foco"));
      input.addEventListener("blur", () => $(`#${id}`).classList.remove("is-foco"));
      return input;
    };
    campos.numero = criar("mpNumero", { inputMode: "numeric", placeholder: "0000 0000 0000 0000", maxLength: 19 });
    campos.validade = criar("mpValidade", { inputMode: "numeric", placeholder: "MM/AA", maxLength: 5 });
    campos.cvv = criar("mpCvv", { inputMode: "numeric", placeholder: "123", maxLength: 4 });

    campos.numero.addEventListener("input", () => {
      const d = campos.numero.value.replace(/\D/g, "").slice(0, 16);
      campos.numero.value = d.replace(/(.{4})(?=.)/g, "$1 ");
      atualizarVisual({ numero: d });
      mostrarBandeira(bandeiraDemo(d));
      cartao.bin = d.slice(0, 6);
      carregarParcelas();
    });
    campos.validade.addEventListener("input", () => {
      const d = campos.validade.value.replace(/\D/g, "").slice(0, 4);
      campos.validade.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
      atualizarVisual({ validade: campos.validade.value });
    });
    campos.cvv.addEventListener("input", () => { campos.cvv.value = campos.cvv.value.replace(/\D/g, ""); });
    $("#pixDemoPagar").hidden = false;
  }

  function bandeiraDemo(d) {
    if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(d)) return "Elo";
    if (/^(606282|3841)/.test(d)) return "Hipercard";
    if (/^3[47]/.test(d)) return "Amex";
    if (/^4/.test(d)) return "Visa";
    if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
    return "";
  }
  const luhn = (d) => [...d].reverse().reduce((s, c, i) => s + (i % 2 ? ((c * 2) > 9 ? c * 2 - 9 : c * 2) : Number(c)), 0) % 10 === 0;

  function parcelasDemo(total) {
    if (!cartao.bin || !total) return [];
    const max = Math.max(1, Math.min(6, Math.floor(total / 20)));
    return Array.from({ length: max }, (_, i) => ({ n: i + 1, texto: `${i + 1}x de ${brl(total / (i + 1))} sem juros` }));
  }

  // QR de mentira (só para demonstração), com o panda no meio
  function qrDemo() {
    const n = 25, t = 8;
    let quad = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const olho = (x < 7 && y < 7) || (x > n - 8 && y < 7) || (x < 7 && y > n - 8);
      if (!olho && Math.random() > 0.52) quad += `<rect x="${x * t}" y="${y * t}" width="${t}" height="${t}"/>`;
    }
    const olho = (x, y) => `<rect x="${x}" y="${y}" width="56" height="56" fill="#0e1613"/><rect x="${x + 8}" y="${y + 8}" width="40" height="40" fill="#fff"/><rect x="${x + 16}" y="${y + 16}" width="24" height="24" fill="#0e1613"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 216 216"><rect x="-8" y="-8" width="216" height="216" fill="#fff"/><g fill="#0e1613">${quad}</g>${olho(0, 0)}${olho(144, 0)}${olho(0, 144)}<rect x="76" y="76" width="48" height="48" rx="10" fill="#fff"/><text x="100" y="105" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#b3261e">DEMO</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  /* ---------- Pix ---------- */
  function pararPix() {
    if (!pix) return;
    clearInterval(pix.timer);
    clearInterval(pix.consulta);
    pix = null;
  }

  function mostrarPix(r, total) {
    pararPix();
    $("#pixPassos").hidden = true;
    $("#pixCodigo").hidden = false;
    $("#pixQr").src = r.pix.qrBase64 ? `data:image/png;base64,${r.pix.qrBase64}` : qrDemo();
    $("#pixCopia").value = r.pix.copiaECola;
    $("#pixStatus").className = "pix-status";
    $("#pixStatus").innerHTML = `<span class="pix-status__ponto"></span> Aguardando o pagamento…`;
    pix = { id: r.id, total, expira: Date.parse(r.pix.expira) || Date.now() + 30 * 60_000, pedido: r.pedido, chave: r.chave };

    const relogio = () => {
      const resta = Math.max(0, pix.expira - Date.now());
      $("#pixTempo").textContent = `${String(Math.floor(resta / 60000)).padStart(2, "0")}:${String(Math.floor((resta % 60000) / 1000)).padStart(2, "0")}`;
      if (!resta) expirarPix();
    };
    relogio();
    pix.timer = setInterval(relogio, 1000);
    if (modo === "real") pix.consulta = setInterval(consultarPix, 5000);
    opcoes.aoMudarMetodo(metodo);
    $("#pixCodigo").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function consultarPix() {
    if (!pix) return;
    try {
      const r = await (await fetch(`api/pagamento?id=${pix.id}`, { cache: "no-store" })).json();
      if (r.status === "approved") concluir({ status: "approved", id: pix.id, pedido: pix.pedido, chave: pix.chave, metodo: "Pix" });
      else if (r.status === "rejected" || r.status === "cancelled") expirarPix("O Pix foi cancelado. Gere um novo para pagar.");
    } catch { /* tenta de novo na próxima */ }
  }

  function expirarPix(texto = "O tempo do Pix acabou. Gere um novo código para pagar.") {
    pararPix();
    $("#pixStatus").className = "pix-status is-erro";
    $("#pixStatus").textContent = texto;
    opcoes.aoMudarMetodo(metodo);
  }

  $("#pixCopiar").addEventListener("click", async () => {
    const botao = $("#pixCopiar");
    try {
      await navigator.clipboard.writeText($("#pixCopia").value);
    } catch {
      $("#pixCopia").select();
      document.execCommand?.("copy");
    }
    botao.textContent = "Código copiado! ✓";
    document.dispatchEvent(new CustomEvent("ffn:festa", { detail: { alvo: botao, quantidade: 8 } }));
    setTimeout(() => (botao.textContent = "Copiar código Pix"), 2500);
  });

  $("#pixDemoPagar").addEventListener("click", () => {
    if (pix) concluir({ status: "approved", id: pix.id, pedido: pix.pedido, metodo: "Pix (demonstração)" });
  });

  /* ---------- Concluir ---------- */
  function concluir(r) {
    pararPix();
    opcoes.aoConcluir(r);
  }

  /* ---------- Pagar ---------- */
  async function pagar(d) {
    const total = opcoes.obterTotal();
    if (metodo === "pix") return pagarPix(d, total);
    return pagarCartao(d, total);
  }

  async function enviar(corpo) {
    const r = await fetch("api/pagamento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const resp = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(resp.erro || "Não foi possível processar o pagamento agora");
    return resp;
  }

  async function pagarPix(d, total) {
    if (modo === "demo") {
      await new Promise((ok) => setTimeout(ok, 700));
      return mostrarPix({ id: "DEMO", pedido: d.pedido, pix: { copiaECola: `00020126580014BR.GOV.BCB.PIX-DEMONSTRACAO-BOUTIQUE-FFN-${d.pedido}-NAO-PAGUE`, expira: new Date(Date.now() + 30 * 60_000).toISOString() } }, total);
    }
    const r = await enviar({ ...d, metodo: "pix", idempotencia: novaChave(), dispositivo: window.MP_DEVICE_SESSION_ID });
    if (r.status === "approved") return concluir({ status: "approved", id: r.id, pedido: r.pedido, chave: r.chave, metodo: "Pix" });
    if (!r.pix) throw new Error("O Mercado Pago não gerou o Pix agora. Tente de novo.");
    mostrarPix(r, total);
  }

  async function pagarCartao(d, total) {
    const aviso = (t) => { $("#cartaoAviso").textContent = t; if (t) $("#cartaoAviso").scrollIntoView({ behavior: "smooth", block: "center" }); };
    aviso("");
    const titular = document.querySelector("[name=titular]");
    const parcelas = Number($("#parcelas").value);
    if (!cartao.bin) return aviso("Digite o número do cartão.");
    if (!titular.value.trim()) { titular.classList.add("is-invalido"); titular.focus({ preventScroll: true }); return aviso("Digite o nome impresso no cartão."); }
    if (!parcelas) return aviso("Escolha o número de parcelas.");

    if (modo === "demo") {
      const num = campos.numero.value.replace(/\D/g, "");
      const [mm, aa] = campos.validade.value.split("/").map(Number);
      const agora = new Date();
      if (num.length < 13 || !luhn(num)) return aviso("Confira o número do cartão.");
      if (!(mm >= 1 && mm <= 12) || !aa || new Date(2000 + aa, mm) <= agora) return aviso("Confira a validade do cartão.");
      if (campos.cvv.value.length < 3) return aviso("Confira o código de segurança (CVV).");
      await new Promise((ok) => setTimeout(ok, 1200));
      return concluir({ status: "approved", id: "DEMO", pedido: d.pedido, metodo: `Cartão ${cartao.bandeira || ""} em ${parcelas}x (demonstração)`.replace("  ", " ") });
    }

    if (!mp) return aviso("O pagamento com cartão não carregou agora. Use o Pix ou tente mais tarde.");
    let token;
    try {
      token = await mp.fields.createCardToken({ cardholderName: titular.value.trim(), identificationType: "CPF", identificationNumber: d.cpf });
    } catch {
      return aviso("Confira os dados do cartão (número, validade e CVV).");
    }
    const r = await enviar({
      ...d,
      metodo: "cartao",
      idempotencia: novaChave(),
      dispositivo: window.MP_DEVICE_SESSION_ID,
      cartao: { token: token.id, payment_method_id: cartao.paymentMethodId, issuer_id: cartao.issuerId, installments: parcelas },
    });
    const forma = `Cartão ${cartao.bandeira} em ${r.parcelas || parcelas}x`;
    if (r.status === "approved") return concluir({ status: "approved", id: r.id, pedido: r.pedido, chave: r.chave, metodo: forma });
    if (r.status === "in_process" || r.status === "pending") return concluir({ status: "in_process", id: r.id, pedido: r.pedido, chave: r.chave, metodo: forma });
    return aviso(r.mensagem || "O pagamento foi recusado. Tente outro cartão ou pague com Pix.");
  }

  /* ---------- Início ---------- */
  async function iniciar(o) {
    opcoes = { ...opcoes, ...o };
    ligarAbas();
    document.querySelector("[name=titular]").addEventListener("input", (e) => {
      e.target.classList.remove("is-invalido");
      atualizarVisual({ nome: e.target.value });
    });
    let config = null;
    try {
      const r = await fetch("api/config", { cache: "no-store" });
      if (r.ok) config = await r.json();
    } catch { /* sem servidor: prévia estática */ }

    if (config?.mercadoPago?.publicKey) {
      try {
        await iniciarReal(config.mercadoPago.publicKey);
        modo = "real";
      } catch {
        $("#cartaoAviso").textContent = "Não foi possível carregar o pagamento com cartão agora. Use o Pix ou tente mais tarde.";
        modo = "real";
      }
    } else {
      modo = "demo";
      iniciarDemo();
    }
    opcoes.aoMudarMetodo(metodo);
  }

  return {
    iniciar,
    pagar,
    get metodo() { return metodo; },
    get pixAtivo() { return !!pix; },
    // o total mudou (sacola ou frete): parcelas novas e Pix antigo deixa de valer
    totalMudou(total) {
      if (pix && Math.abs(pix.total - total) > 0.001) expirarPix("O pedido mudou. Gere um novo Pix com o valor atualizado.");
      if (cartao.bin) carregarParcelas();
    },
  };
})();
