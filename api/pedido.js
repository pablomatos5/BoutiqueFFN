/*
 * Acompanhar pedido (cliente).
 *   GET  /api/pedido?pedido=FFN-...&chave=...   link enviado na confirmação e no WhatsApp
 *   POST /api/pedido { pedido, cpf }             quem digita o número do pedido e o CPF
 * Devolve só a versão pública do pedido (sem CPF, e-mail, telefone ou endereço) e o rastreio dos Correios.
 */
import { responder } from "./frete.js";
import { abrirBanco } from "./_db.js";
import { podeVer, versaoPublica, rastrear, aplicarRastreio } from "./_pedidos.js";

async function lerCorpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let bruto = "";
  for await (const parte of req) bruto += parte;
  try { return JSON.parse(bruto || "{}"); } catch { return {}; }
}

export default async function handler(req, res, env = process.env) {
  res.setHeader("Cache-Control", "no-store");
  const banco = abrirBanco(env);
  if (!banco) return responder(res, 503, { erro: "Acompanhamento ainda não configurado" });

  const q = new URL(req.url, "http://localhost").searchParams;
  const dados = req.method === "POST" ? await lerCorpo(req) : { pedido: q.get("pedido"), chave: q.get("chave") };
  const id = String(dados.pedido || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40);
  const naoEncontrado = () => responder(res, 404, { erro: "Não encontramos esse pedido. Confira o número e o CPF." });
  if (!id) return naoEncontrado();

  // limita tentativas com CPF por pedido (evita adivinhação)
  if (!dados.chave) {
    const chaveLimite = `tentativas:${id}`;
    const tentativas = (await banco.lerCache(chaveLimite).catch(() => 0)) || 0;
    if (tentativas >= 8) return responder(res, 429, { erro: "Muitas tentativas. Espere alguns minutos ou fale com a loja no WhatsApp." });
    await banco.gravarCache(chaveLimite, tentativas + 1, 15 * 60).catch(() => {});
  }

  const pedido = await banco.obter(id);
  if (!pedido || !podeVer(pedido, { chave: dados.chave, cpf: dados.cpf })) return naoEncontrado();

  let rastreio = null;
  if (pedido.rastreio) {
    try {
      rastreio = await rastrear(pedido.rastreio, env, banco);
      if (aplicarRastreio(pedido, rastreio)) await banco.salvar(pedido);
    } catch (e) {
      console.error("[rastreio]", e.message);
    }
  }
  return responder(res, 200, { pedido: versaoPublica(pedido), chave: pedido.chave, rastreio });
}
