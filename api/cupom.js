/*
 * GET /api/cupom?codigo=X&subtotal=123.45 → { codigo, desconto, descricao } ou erro
 * Só confere para mostrar o desconto na tela; o valor cobrado é recalculado em /api/pagamento.
 */
import { responder } from "./frete.js";
import { abrirBanco } from "./_db.js";
import { dentroDoLimite } from "./_limite.js";
import { aplicarCupom } from "./_cupons.js";

export default async function handler(req, res, env = process.env) {
  res.setHeader("Cache-Control", "no-store");
  const banco = abrirBanco(env);
  if (!banco) return responder(res, 503, { erro: "Cupons ainda não configurados" });
  if (!(await dentroDoLimite(banco, "cupom", req, 20, 10 * 60))) return responder(res, 429, { erro: "Muitas tentativas. Espere alguns minutos." });
  const q = new URL(req.url, "http://localhost").searchParams;
  const r = await aplicarCupom(banco, q.get("codigo"), Number(q.get("subtotal")) || 0);
  if (r.erro) return responder(res, 400, { erro: r.erro });
  const { cupom, desconto } = r;
  return responder(res, 200, { codigo: cupom.codigo, desconto, descricao: cupom.tipo === "valor" ? `R$ ${cupom.valor.toFixed(2).replace(".", ",")} de desconto` : `${cupom.valor}% de desconto` });
}
