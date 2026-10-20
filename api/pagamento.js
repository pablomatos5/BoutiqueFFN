/*
 * Pagamento dentro do site (Checkout Transparente do Mercado Pago).
 *
 * POST /api/pagamento        cria o pagamento (Pix ou cartão) e devolve o resultado
 *   Corpo: { pedido, idempotencia, nome, email, cpf, telefone, obs, entrega: "retirada"|"entrega",
 *            cep, servico, endereco, itens: [{ id, cor, tamanho, qtd }],
 *            metodo: "pix"|"cartao", cartao?: { token, payment_method_id, issuer_id, installments },
 *            dispositivo? }
 *   Preços e frete são recalculados aqui (catálogo + Correios): o valor nunca vem do navegador.
 *   Os dados do cartão nunca chegam aqui: o navegador manda só o token gerado pelos campos seguros do Mercado Pago.
 *
 * GET /api/pagamento?id=123  situação de um pagamento (usado para saber quando o Pix foi pago)
 *
 * O pedido é gravado no banco (api/_db.js) quando o Pix é gerado ou o cartão é aprovado,
 * e avança para "aprovado" quando o pagamento se confirma (aqui, na consulta do Pix ou pelo webhook).
 *
 * Variáveis de ambiente:
 *   MP_ACCESS_TOKEN  Access Token da conta Mercado Pago da loja (obrigatória)
 *   MP_PUBLIC_KEY    Public Key da mesma conta (lida pelo navegador via /api/config)
 *   PIX_MINUTOS      validade do Pix em minutos (padrão 30)
 *   SITE_URL         endereço público do site (opcional; usado no aviso automático do Mercado Pago)
 */

import fs from "node:fs";
import path from "node:path";
import { cotarFrete, normalizarPeso, responder } from "./frete.js";
import { abrirBanco } from "./_db.js";
import { dentroDoLimite } from "./_limite.js";
import { criarPedido, aplicarPagamento } from "./_pedidos.js";

const PESO_PADRAO = 300;
const API = "https://api.mercadopago.com";

// js/produtos.js é um script de navegador; aqui ele é avaliado para ler o mesmo catálogo
function carregarCatalogo() {
  const fonte = fs.readFileSync(path.join(process.cwd(), "js", "produtos.js"), "utf8");
  return new Function(`${fonte}; return PRODUTOS;`)();
}

async function lerCorpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let bruto = "";
  for await (const parte of req) bruto += parte;
  return JSON.parse(bruto || "{}");
}

const semAcento = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const soDigitos = (s) => String(s || "").replace(/\D/g, "");
const centavos = (v) => Math.round(v * 100) / 100;

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

async function valorFrete(dados, peso, env) {
  if (dados.entrega !== "entrega") return { valor: 0, descricao: "Retirada na loja" };

  const cep = soDigitos(dados.cep);
  if (cep.length !== 8) throw Object.assign(new Error("CEP inválido"), { status: 400 });

  let local = null;
  try {
    local = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
  } catch { /* ViaCEP fora do ar */ }
  if (!local || local.erro) throw Object.assign(new Error("CEP não encontrado"), { status: 400 });
  if (local.uf === "PA" && semAcento(local.localidade) === "cameta") return { valor: 0, descricao: "Entrega grátis em Cametá", local };

  const opcoes = await cotarFrete(cep, normalizarPeso(peso), env).catch(() => {
    throw Object.assign(new Error("Frete indisponível para pagamento online"), { status: 409 });
  });
  const escolhida = opcoes.find((o) => o.codigo === dados.servico) || opcoes[0];
  return { valor: escolhida.preco, descricao: `${escolhida.servico} para ${local.localidade}-${local.uf}`, local };
}

// validade do Pix no fuso de Brasília, no formato que o Mercado Pago aceita
function expiracaoPix(minutos) {
  const d = new Date(Date.now() + minutos * 60_000 - 3 * 3600_000);
  return `${d.toISOString().slice(0, 23)}-03:00`;
}

// mensagens amigáveis para as recusas mais comuns de cartão
const RECUSAS = {
  cc_rejected_bad_filled_card_number: "Confira o número do cartão.",
  cc_rejected_bad_filled_date: "Confira a validade do cartão.",
  cc_rejected_bad_filled_security_code: "Confira o código de segurança (CVV).",
  cc_rejected_bad_filled_other: "Confira os dados do cartão.",
  cc_rejected_insufficient_amount: "O cartão não tem limite suficiente.",
  cc_rejected_call_for_authorize: "Seu banco pediu autorização. Ligue para ele e tente de novo.",
  cc_rejected_card_disabled: "O cartão está inativo. Fale com o seu banco.",
  cc_rejected_duplicated_payment: "Esse pagamento já foi feito. Confira seu extrato antes de tentar de novo.",
  cc_rejected_high_risk: "O pagamento foi recusado por segurança. Tente outro cartão ou pague com Pix.",
  cc_rejected_max_attempts: "Você atingiu o limite de tentativas. Tente outro cartão ou pague com Pix.",
  cc_rejected_blacklist: "O pagamento não pôde ser processado. Tente outro cartão ou pague com Pix.",
  cc_rejected_other_reason: "O banco recusou o pagamento. Tente outro cartão ou pague com Pix.",
};

function resumoPagamento(p) {
  const pix = p.point_of_interaction?.transaction_data;
  return {
    id: p.id,
    status: p.status, // approved | pending | in_process | rejected | cancelled
    detalhe: p.status_detail,
    mensagem: p.status === "rejected" ? RECUSAS[p.status_detail] || RECUSAS.cc_rejected_other_reason : undefined,
    parcelas: p.installments,
    pix: pix ? { copiaECola: pix.qr_code, qrBase64: pix.qr_code_base64, link: pix.ticket_url, expira: p.date_of_expiration } : undefined,
  };
}

// Atualiza o pedido gravado com a situação do pagamento (usado também pelo webhook)
export async function atualizarPedido(mp, env = process.env) {
  try {
    const banco = abrirBanco(env);
    const pedido = banco && (await banco.obter(mp.external_reference));
    if (pedido && aplicarPagamento(pedido, mp)) await banco.salvar(pedido);
    return pedido;
  } catch (e) {
    console.error("[pedido] não foi possível atualizar", e.message);
    return null;
  }
}

async function consultar(req, res, env) {
  const id = soDigitos(new URL(req.url, "http://localhost").searchParams.get("id"));
  if (!id) return responder(res, 400, { erro: "Informe o id" });
  const r = await fetch(`${API}/v1/payments/${id}`, { headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` } });
  if (!r.ok) return responder(res, r.status === 404 ? 404 : 502, { erro: "Pagamento não encontrado" });
  const p = await r.json();
  if (p.external_reference) await atualizarPedido(p, env);
  res.setHeader("Cache-Control", "no-store");
  // só a situação: nada de dados do cliente
  return responder(res, 200, { id: p.id, status: p.status, detalhe: p.status_detail });
}

export default async function handler(req, res, env = process.env) {
  if (!env.MP_ACCESS_TOKEN) return responder(res, 503, { erro: "Pagamento online ainda não configurado" });
  if (req.method === "GET") return consultar(req, res, env);
  if (req.method !== "POST") return responder(res, 405, { erro: "Método não permitido" });

  // no máximo 15 tentativas de pagamento a cada 10 minutos por endereço (evita Pix falso em massa)
  if (!(await dentroDoLimite(abrirBanco(env), "pagamento", req, 15, 10 * 60))) {
    return responder(res, 429, { erro: "Muitas tentativas seguidas. Espere alguns minutos ou fale com a loja no WhatsApp." });
  }

  let dados;
  try {
    dados = await lerCorpo(req);
  } catch {
    return responder(res, 400, { erro: "Pedido inválido" });
  }

  // cliente
  const nome = String(dados.nome || "").trim().slice(0, 80);
  const email = String(dados.email || "").trim().slice(0, 120);
  const cpf = soDigitos(dados.cpf);
  if (!nome) return responder(res, 400, { erro: "Informe seu nome" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return responder(res, 400, { erro: "Informe um e-mail válido" });
  if (!cpfValido(cpf)) return responder(res, 400, { erro: "Informe um CPF válido" });

  // itens pelo catálogo
  const catalogo = carregarCatalogo();
  const itens = [];
  const itensPedido = [];
  let peso = 0;
  for (const i of Array.isArray(dados.itens) ? dados.itens.slice(0, 50) : []) {
    const p = catalogo.find((x) => x.id === i.id);
    const qtd = Math.trunc(Number(i.qtd));
    if (!p || !p.cores.includes(i.cor) || !p.tamanhos.includes(i.tamanho) || !(qtd >= 1 && qtd <= 20)) {
      return responder(res, 400, { erro: "Item inválido na sacola" });
    }
    itens.push({ id: p.id, title: `${p.nome} (${i.cor}, tam. ${i.tamanho})`, category_id: "fashion", quantity: qtd, unit_price: p.preco });
    itensPedido.push({ nome: p.nome, cor: i.cor, tamanho: i.tamanho, qtd, preco: p.preco });
    peso += (p.peso || PESO_PADRAO) * qtd;
  }
  if (!itens.length) return responder(res, 400, { erro: "Sacola vazia" });

  let frete;
  try {
    frete = await valorFrete(dados, peso, env);
  } catch (e) {
    return responder(res, e.status || 500, { erro: e.message });
  }

  const total = centavos(itens.reduce((s, i) => s + i.unit_price * i.quantity, 0) + frete.valor);
  const pedido = String(dados.pedido || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 40) || `FFN-${Date.now().toString(36).toUpperCase()}`;
  const e = dados.endereco || {};
  const [primeiro, ...resto] = nome.split(/\s+/);
  const telefone = soDigitos(dados.telefone);

  const pagamento = {
    transaction_amount: total,
    description: `Pedido ${pedido} · Boutique FFN`,
    external_reference: pedido,
    statement_descriptor: "BOUTIQUE FFN",
    payer: { email, first_name: primeiro, last_name: resto.join(" ") || primeiro, identification: { type: "CPF", number: cpf } },
    additional_info: {
      items: itens,
      payer: {
        first_name: primeiro,
        last_name: resto.join(" "),
        phone: telefone.length >= 10 ? { area_code: telefone.slice(0, 2), number: telefone.slice(2) } : undefined,
      },
      shipments: dados.entrega === "entrega"
        ? { receiver_address: { zip_code: soDigitos(dados.cep), street_name: String(e.rua || "").slice(0, 100), street_number: String(e.numero || "").slice(0, 10), city_name: frete.local?.localidade, state_name: frete.local?.uf } }
        : undefined,
    },
    metadata: {
      pedido,
      cliente: nome,
      telefone: String(dados.telefone || "").slice(0, 20),
      observacoes: String(dados.obs || "").slice(0, 300),
      entrega: frete.descricao,
      frete: frete.valor,
      endereco: dados.entrega === "entrega" ? [e.rua, e.numero, e.complemento, e.bairro, dados.cep].filter(Boolean).join(", ") : "",
    },
  };

  if (dados.metodo === "pix") {
    pagamento.payment_method_id = "pix";
    pagamento.date_of_expiration = expiracaoPix(Number(env.PIX_MINUTOS) || 30);
  } else if (dados.metodo === "cartao") {
    const c = dados.cartao || {};
    const parcelas = Math.trunc(Number(c.installments));
    if (!c.token || !c.payment_method_id || !(parcelas >= 1 && parcelas <= 12)) return responder(res, 400, { erro: "Dados do cartão incompletos" });
    Object.assign(pagamento, { token: String(c.token), payment_method_id: String(c.payment_method_id), installments: parcelas });
    if (c.issuer_id) pagamento.issuer_id = Number(c.issuer_id) || String(c.issuer_id);
  } else {
    return responder(res, 400, { erro: "Escolha Pix ou cartão" });
  }

  const cabecalhos = {
    Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
    // evita cobrança dupla se a mesma tentativa chegar duas vezes
    "X-Idempotency-Key": String(dados.idempotencia || `${pedido}-${dados.metodo}`).slice(0, 64),
  };
  if (dados.dispositivo) cabecalhos["X-meli-session-id"] = String(dados.dispositivo).slice(0, 100);

  const host = req.headers?.["x-forwarded-host"] || req.headers?.host || "";
  const site = (env.SITE_URL || `${req.headers?.["x-forwarded-proto"] || "https"}://${host}`).replace(/\/$/, "");
  if (site.startsWith("https://") && !host.startsWith("localhost")) pagamento.notification_url = `${site}/api/webhook-mp`;

  // um pedido já pago não pode ser cobrado de novo
  const banco = abrirBanco(env);
  const existente = await banco?.obter(pedido).catch(() => null);
  if (existente && !["aguardando", "cancelado"].includes(existente.status)) return responder(res, 409, { erro: "Esse pedido já foi pago." });

  const r = await fetch(`${API}/v1/payments`, { method: "POST", headers: cabecalhos, body: JSON.stringify(pagamento) });
  const resposta = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("[pagamento] Mercado Pago", r.status, JSON.stringify(resposta));
    return responder(res, 502, { erro: "Não foi possível processar o pagamento agora. Tente de novo ou pague com Pix." });
  }
  // grava o pedido (cartão recusado não vira pedido)
  let chave;
  if (resposta.status !== "rejected" && banco) {
    try {
      const novo = criarPedido({
        id: pedido,
        cliente: { nome, email, cpf, telefone: String(dados.telefone || "").slice(0, 20) },
        entrega: {
          tipo: dados.entrega !== "entrega" ? "retirada" : frete.descricao.startsWith("Entrega grátis") ? "local" : "correios",
          descricao: frete.descricao,
          endereco: dados.entrega === "entrega" ? [[e.rua, e.numero].filter(Boolean).join(", "), e.complemento, e.bairro].filter(Boolean).join(" · ") : "",
          cep: soDigitos(dados.cep),
          cidade: frete.local?.localidade || "Cametá",
          uf: frete.local?.uf || "PA",
        },
        itens: itensPedido,
        subtotal: centavos(total - frete.valor),
        frete: frete.valor,
        total,
        obs: String(dados.obs || "").slice(0, 300),
        pagamento: { metodo: dados.metodo === "pix" ? "Pix" : "Cartão", mpId: resposta.id, status: resposta.status, parcelas: resposta.installments },
      });
      if (existente) { novo.chave = existente.chave; novo.criadoEm = existente.criadoEm; }
      aplicarPagamento(novo, resposta);
      await banco.salvar(novo);
      chave = novo.chave;
    } catch (err) {
      console.error("[pedido] não foi possível gravar", err.message);
    }
  }

  res.setHeader("Cache-Control", "no-store");
  return responder(res, 200, { pedido, total, chave, ...resumoPagamento(resposta) });
}
