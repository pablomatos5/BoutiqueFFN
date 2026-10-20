/*
 * GET /api/frete?cep=01001000&peso=600
 *
 * Calcula PAC e SEDEX na API oficial dos Correios (api.correios.com.br).
 * Roda no servidor (função serverless da Vercel ou `npm run dev`) porque
 * as credenciais do contrato não podem ficar no navegador.
 *
 * Variáveis de ambiente (veja .env.example):
 *   CORREIOS_USUARIO, CORREIOS_CODIGO_ACESSO, CORREIOS_CARTAO_POSTAGEM  obrigatórias
 *   CORREIOS_CONTRATO, CORREIOS_DR                                      opcionais
 *   CEP_ORIGEM            CEP da loja (padrão 68400000, Cametá-PA)
 *   CORREIOS_SERVICOS     "codigo:Nome,..." (padrão 03298:PAC,03220:SEDEX)
 *   CAIXA_CM              "comprimento,largura,altura" (padrão 30,20,10)
 */

const API = "https://api.correios.com.br";
let tokenCache = { token: null, expira: 0 };

export async function obterToken(env) {
  if (tokenCache.token && Date.now() < tokenCache.expira - 60_000) return tokenCache.token;

  const basic = Buffer.from(`${env.CORREIOS_USUARIO}:${env.CORREIOS_CODIGO_ACESSO}`).toString("base64");
  const r = await fetch(`${API}/token/v1/autentica/cartaopostagem`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    body: JSON.stringify({ numero: env.CORREIOS_CARTAO_POSTAGEM }),
  });
  if (!r.ok) throw new Error(`Autenticação nos Correios falhou (${r.status})`);
  const dados = await r.json();
  tokenCache = { token: dados.token, expira: Date.parse(dados.expiraEm) || Date.now() + 30 * 60_000 };
  return tokenCache.token;
}

const numeroBR = (v) => Number(String(v).replace(/\./g, "").replace(",", "."));

async function cotar(env, token, codigo, cepDestino, peso) {
  const [comprimento, largura, altura] = (env.CAIXA_CM || "30,20,10").split(",");
  const cepOrigem = env.CEP_ORIGEM || "68400000";
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const qPreco = new URLSearchParams({ cepOrigem, cepDestino, psObjeto: String(peso), tpObjeto: "2", comprimento, largura, altura });
  if (env.CORREIOS_CONTRATO) qPreco.set("nuContrato", env.CORREIOS_CONTRATO);
  if (env.CORREIOS_DR) qPreco.set("nuDR", env.CORREIOS_DR);
  const qPrazo = new URLSearchParams({ cepOrigem, cepDestino });

  const [rPreco, rPrazo] = await Promise.all([
    fetch(`${API}/preco/v1/nacional/${codigo}?${qPreco}`, auth),
    fetch(`${API}/prazo/v1/nacional/${codigo}?${qPrazo}`, auth),
  ]);
  if (!rPreco.ok) throw new Error(`Preço ${codigo} indisponível (${rPreco.status})`);
  const preco = await rPreco.json();
  const prazo = rPrazo.ok ? await rPrazo.json() : {};
  return { preco: numeroBR(preco.pcFinal), prazo: prazo.prazoEntrega ?? null };
}

export function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", status === 200 ? "s-maxage=3600" : "no-store");
  res.end(JSON.stringify(corpo));
}

// Cota PAC/SEDEX para o CEP. Lança erro com .status em caso de falha.
export async function cotarFrete(cep, peso, env = process.env) {
  if (!env.CORREIOS_USUARIO || !env.CORREIOS_CODIGO_ACESSO || !env.CORREIOS_CARTAO_POSTAGEM) {
    throw Object.assign(new Error("Cálculo de frete dos Correios ainda não configurado"), { status: 503 });
  }
  const servicos = (env.CORREIOS_SERVICOS || "03298:PAC,03220:SEDEX").split(",").map((s) => s.split(":"));
  let token;
  try {
    token = await obterToken(env);
  } catch (e) {
    console.error("[frete]", e);
    throw Object.assign(new Error("Não foi possível consultar os Correios agora"), { status: 502 });
  }
  const resultados = await Promise.allSettled(servicos.map(([codigo]) => cotar(env, token, codigo, cep, peso)));
  const opcoes = resultados
    .map((r, i) => (r.status === "fulfilled" && r.value.preco > 0 ? { servico: servicos[i][1], codigo: servicos[i][0], ...r.value } : null))
    .filter(Boolean)
    .sort((a, b) => a.preco - b.preco);
  if (!opcoes.length) throw Object.assign(new Error("Os Correios não retornaram opções para este CEP"), { status: 502 });
  return opcoes;
}

export const normalizarPeso = (g) => Math.min(30000, Math.max(300, Math.ceil(Number(g) || 300)));

export default async function handler(req, res, env = process.env) {
  const params = new URL(req.url, "http://localhost").searchParams;
  const cep = (params.get("cep") || "").replace(/\D/g, "");
  if (cep.length !== 8) return responder(res, 400, { erro: "CEP inválido" });
  try {
    return responder(res, 200, { opcoes: await cotarFrete(cep, normalizarPeso(params.get("peso")), env) });
  } catch (e) {
    return responder(res, e.status || 500, { erro: e.message });
  }
}
