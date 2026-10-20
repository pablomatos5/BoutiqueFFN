/*
 * POST /api/pagamento
 *
 * Cria uma preferência do Mercado Pago (Checkout Pro) e devolve o link de pagamento.
 * Preços e frete são recalculados aqui a partir do catálogo e dos Correios:
 * o valor cobrado nunca vem do navegador.
 *
 * Corpo: { pedido, nome, telefone, obs, entrega: "retirada"|"entrega", cep, servico, endereco,
 *          itens: [{ id, cor, tamanho, qtd }] }
 *
 * Variáveis de ambiente:
 *   MP_ACCESS_TOKEN  Access Token de produção da conta Mercado Pago da loja (obrigatória)
 *   SITE_URL         endereço público do site (opcional; senão usa o host da requisição)
 */

import fs from "node:fs";
import path from "node:path";
import { cotarFrete, normalizarPeso, responder } from "./frete.js";

const PESO_PADRAO = 300;

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

async function valorFrete(dados, peso, env) {
  if (dados.entrega !== "entrega") return { valor: 0, descricao: "Retirada na loja" };

  const cep = String(dados.cep || "").replace(/\D/g, "");
  if (cep.length !== 8) throw Object.assign(new Error("CEP inválido"), { status: 400 });

  let local = null;
  try {
    local = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
  } catch { /* ViaCEP fora do ar */ }
  if (!local || local.erro) throw Object.assign(new Error("CEP não encontrado"), { status: 400 });
  if (local.uf === "PA" && semAcento(local.localidade) === "cameta") return { valor: 0, descricao: "Entrega grátis em Cametá" };

  const opcoes = await cotarFrete(cep, normalizarPeso(peso), env).catch((e) => {
    throw Object.assign(new Error("Frete indisponível para pagamento online"), { status: 409, causa: e.message });
  });
  const escolhida = opcoes.find((o) => o.codigo === dados.servico) || opcoes[0];
  return { valor: escolhida.preco, descricao: `${escolhida.servico} para ${local.localidade}-${local.uf}` };
}

export default async function handler(req, res, env = process.env) {
  if (req.method !== "POST") return responder(res, 405, { erro: "Use POST" });
  if (!env.MP_ACCESS_TOKEN) return responder(res, 503, { erro: "Pagamento online ainda não configurado" });

  let dados;
  try {
    dados = await lerCorpo(req);
  } catch {
    return responder(res, 400, { erro: "Pedido inválido" });
  }

  const catalogo = carregarCatalogo();
  const itens = [];
  let peso = 0;
  for (const i of Array.isArray(dados.itens) ? dados.itens.slice(0, 50) : []) {
    const p = catalogo.find((x) => x.id === i.id);
    const qtd = Math.trunc(Number(i.qtd));
    if (!p || !p.cores.includes(i.cor) || !p.tamanhos.includes(i.tamanho) || !(qtd >= 1 && qtd <= 20)) {
      return responder(res, 400, { erro: "Item inválido na sacola" });
    }
    itens.push({ id: p.id, title: `${p.nome} (${i.cor}, tam. ${i.tamanho})`, quantity: qtd, unit_price: p.preco, currency_id: "BRL" });
    peso += (p.peso || PESO_PADRAO) * qtd;
  }
  if (!itens.length) return responder(res, 400, { erro: "Sacola vazia" });

  let frete;
  try {
    frete = await valorFrete(dados, peso, env);
  } catch (e) {
    return responder(res, e.status || 500, { erro: e.message });
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || (host?.startsWith("localhost") ? "http" : "https");
  const site = (env.SITE_URL || `${proto}://${host}`).replace(/\/$/, "");
  const pedido = String(dados.pedido || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 40) || `FFN-${Date.now().toString(36).toUpperCase()}`;
  const e = dados.endereco || {};

  const preferencia = {
    items: itens,
    payer: { name: String(dados.nome || "").slice(0, 80) },
    shipments: { mode: "not_specified", cost: frete.valor },
    external_reference: pedido,
    statement_descriptor: "BOUTIQUE FFN",
    back_urls: {
      success: `${site}/finalizar.html?pagamento=aprovado`,
      pending: `${site}/finalizar.html?pagamento=pendente`,
      failure: `${site}/finalizar.html?pagamento=falhou`,
    },
    metadata: {
      pedido,
      cliente: dados.nome,
      telefone: String(dados.telefone || "").slice(0, 20),
      observacoes: String(dados.obs || "").slice(0, 300),
      entrega: frete.descricao,
      endereco: dados.entrega === "entrega" ? [e.rua, e.numero, e.complemento, e.bairro, dados.cep].filter(Boolean).join(", ") : "",
    },
  };
  if (site.startsWith("https://")) preferencia.auto_return = "approved";

  const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json", "X-Idempotency-Key": pedido },
    body: JSON.stringify(preferencia),
  });
  if (!r.ok) {
    console.error("[pagamento] Mercado Pago", r.status, await r.text());
    return responder(res, 502, { erro: "Não foi possível iniciar o pagamento agora" });
  }
  const pref = await r.json();
  return responder(res, 200, { url: pref.init_point, pedido, frete: frete.valor });
}
