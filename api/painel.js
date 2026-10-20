/*
 * Painel da loja (protegido por senha).
 *   POST /api/painel?acao=entrar     { senha }                         → { token } válido por 12 h
 *   GET  /api/painel?acao=pedidos                                       → lista dos pedidos
 *   POST /api/painel?acao=atualizar  { id, status?, rastreio?, nota? } → pedido atualizado
 *   GET  /api/painel?acao=rastreio&id=FFN-...                           → rastreio dos Correios
 * Variáveis: PAINEL_SENHA (obrigatória) e PAINEL_SEGREDO (opcional, reforça a assinatura do token).
 */
import crypto from "node:crypto";
import { responder } from "./frete.js";
import { abrirBanco } from "./_db.js";
import { dentroDoLimite } from "./_limite.js";
import { listarCupons, validarCupom, normalizarCodigo } from "./_cupons.js";
import { mudarStatus, STATUS_VALIDOS, codigoRastreioValido, rastrear, aplicarRastreio, ETAPAS } from "./_pedidos.js";

const VALIDADE_H = 12;

async function lerCorpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let bruto = "";
  for await (const parte of req) bruto += parte;
  try { return JSON.parse(bruto || "{}"); } catch { return {}; }
}

const segredo = (env) => `${env.PAINEL_SENHA}::${env.PAINEL_SEGREDO || "ffn"}`;
const assinar = (env, exp) => crypto.createHmac("sha256", segredo(env)).update(String(exp)).digest("hex");
const iguais = (a, b) => {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

function autorizado(req, env) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const [exp, assinatura] = token.split(".");
  return !!exp && !!assinatura && Number(exp) > Date.now() && iguais(assinatura, assinar(env, exp));
}

export default async function handler(req, res, env = process.env) {
  res.setHeader("Cache-Control", "no-store");
  if (!env.PAINEL_SENHA) return responder(res, 503, { erro: "Painel ainda não configurado (defina PAINEL_SENHA)" });
  const acao = new URL(req.url, "http://localhost").searchParams.get("acao");

  if (acao === "entrar") {
    // no máximo 10 tentativas de senha a cada 15 minutos por endereço
    if (!(await dentroDoLimite(abrirBanco(env), "painel", req, 10, 15 * 60))) {
      return responder(res, 429, { erro: "Muitas tentativas. Espere 15 minutos." });
    }
    const { senha } = await lerCorpo(req);
    if (!senha || !iguais(senha, env.PAINEL_SENHA)) {
      await new Promise((ok) => setTimeout(ok, 800)); // freia tentativas de adivinhar
      return responder(res, 401, { erro: "Senha incorreta" });
    }
    const exp = Date.now() + VALIDADE_H * 3600_000;
    return responder(res, 200, { token: `${exp}.${assinar(env, exp)}`, expira: exp });
  }

  if (!autorizado(req, env)) return responder(res, 401, { erro: "Entre novamente" });
  const banco = abrirBanco(env);
  if (!banco) return responder(res, 503, { erro: "Banco de pedidos não configurado" });

  if (acao === "pedidos") return responder(res, 200, { pedidos: await banco.listar(300), etapas: ETAPAS });

  if (acao === "cupons") return responder(res, 200, { cupons: await listarCupons(banco) });

  if (acao === "salvarCupom" && req.method === "POST") {
    const c = await lerCorpo(req);
    const erro = validarCupom(c);
    if (erro) return responder(res, 400, { erro });
    const lista = await listarCupons(banco);
    const codigo = normalizarCodigo(c.codigo);
    const existente = lista.find((x) => x.codigo === codigo);
    const novo = {
      codigo,
      tipo: c.tipo,
      valor: Math.round(Number(c.valor) * 100) / 100,
      ate: /^\d{4}-\d{2}-\d{2}$/.test(c.ate || "") ? c.ate : "",
      limite: Math.max(0, Math.trunc(Number(c.limite) || 0)),
      minimo: Math.max(0, Number(c.minimo) || 0),
      ativo: c.ativo !== false,
      usos: existente?.usos || 0,
      criadoEm: existente?.criadoEm || new Date().toISOString(),
    };
    await banco.gravarDado("cupons", [novo, ...lista.filter((x) => x.codigo !== codigo)]);
    return responder(res, 200, { cupom: novo });
  }

  if (acao === "apagarCupom" && req.method === "POST") {
    const { codigo } = await lerCorpo(req);
    await banco.gravarDado("cupons", (await listarCupons(banco)).filter((x) => x.codigo !== normalizarCodigo(codigo)));
    return responder(res, 200, { ok: true });
  }

  if (acao === "rastreio") {
    const pedido = await banco.obter(new URL(req.url, "http://localhost").searchParams.get("id"));
    if (!pedido?.rastreio) return responder(res, 404, { erro: "Pedido sem código de rastreio" });
    try {
      const rastreio = await rastrear(pedido.rastreio, env, banco);
      if (aplicarRastreio(pedido, rastreio)) await banco.salvar(pedido);
      return responder(res, 200, { rastreio, pedido });
    } catch (e) {
      return responder(res, 502, { erro: e.message });
    }
  }

  if (acao === "atualizar" && req.method === "POST") {
    const { id, status, rastreio, nota } = await lerCorpo(req);
    const pedido = await banco.obter(String(id || ""));
    if (!pedido) return responder(res, 404, { erro: "Pedido não encontrado" });
    if (rastreio !== undefined) {
      const codigo = String(rastreio).toUpperCase().replace(/\s/g, "");
      if (codigo && !codigoRastreioValido(codigo)) return responder(res, 400, { erro: "Código de rastreio inválido (ex.: AB123456789BR)" });
      pedido.rastreio = codigo;
      // colar o código já marca como enviado
      if (codigo && ["aprovado", "separando"].includes(pedido.status)) mudarStatus(pedido, "enviado", `Código de rastreio ${codigo}`);
    }
    if (status) {
      if (!STATUS_VALIDOS.includes(status)) return responder(res, 400, { erro: "Status inválido" });
      mudarStatus(pedido, status, nota);
    }
    pedido.atualizadoEm = new Date().toISOString();
    await banco.salvar(pedido);
    return responder(res, 200, { pedido });
  }

  return responder(res, 400, { erro: "Ação desconhecida" });
}
