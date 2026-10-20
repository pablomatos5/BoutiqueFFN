/*
 * POST /api/webhook-mp
 * Aviso automático do Mercado Pago quando um pagamento muda (ex.: Pix pago com o site fechado).
 * A situação é sempre buscada de novo na API do Mercado Pago; o corpo do aviso só diz qual pagamento olhar.
 * Com MP_WEBHOOK_SECRET (Suas integrações → Webhooks → assinatura secreta) o aviso também tem a assinatura conferida.
 */
import crypto from "node:crypto";
import { responder } from "./frete.js";
import { atualizarPedido } from "./pagamento.js";

async function lerCorpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let bruto = "";
  for await (const parte of req) bruto += parte;
  try { return JSON.parse(bruto || "{}"); } catch { return {}; }
}

function assinaturaValida(req, idDado, segredo) {
  const partes = Object.fromEntries(String(req.headers["x-signature"] || "").split(",").map((p) => p.trim().split("=")));
  if (!partes.ts || !partes.v1) return false;
  const manifesto = `id:${String(idDado).toLowerCase()};request-id:${req.headers["x-request-id"] || ""};ts:${partes.ts};`;
  const esperado = crypto.createHmac("sha256", segredo).update(manifesto).digest("hex");
  return esperado.length === partes.v1.length && crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(partes.v1));
}

export default async function handler(req, res, env = process.env) {
  if (req.method !== "POST") return responder(res, 405, { erro: "Use POST" });
  if (!env.MP_ACCESS_TOKEN) return responder(res, 503, { erro: "Pagamento não configurado" });

  const corpo = await lerCorpo(req);
  const q = new URL(req.url, "http://localhost").searchParams;
  const tipo = corpo.type || q.get("type") || q.get("topic");
  const id = String(corpo.data?.id || q.get("data.id") || q.get("id") || "").replace(/\D/g, "");
  if (tipo !== "payment" || !id) return responder(res, 200, { ok: true, ignorado: true });

  if (env.MP_WEBHOOK_SECRET && !assinaturaValida(req, q.get("data.id") || id, env.MP_WEBHOOK_SECRET)) {
    return responder(res, 401, { erro: "Assinatura inválida" });
  }

  const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` } });
  if (!r.ok) return responder(res, 200, { ok: true, pagamento: "não encontrado" });
  const mp = await r.json();
  if (mp.external_reference) await atualizarPedido(mp, env);
  return responder(res, 200, { ok: true });
}
