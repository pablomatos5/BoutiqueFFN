/*
 * Armazenamento dos pedidos.
 *   - Vercel KV / Upstash Redis (produção): KV_REST_API_URL + KV_REST_API_TOKEN
 *     (ou UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 *   - Arquivo data/pedidos.json (só no `npm run dev`, para testar sem conta)
 * Sem nenhum dos dois na Vercel, as funções respondem "banco não configurado".
 * Arquivos de api/ que começam com "_" não viram rotas.
 */
import fs from "node:fs";
import path from "node:path";

const PREFIXO = "ffn:";

function redis(url, token) {
  const chamar = async (comandos) => {
    const r = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(comandos),
    });
    if (!r.ok) throw new Error(`Banco respondeu ${r.status}`);
    const res = await r.json();
    const erro = res.find((x) => x.error);
    if (erro) throw new Error(erro.error);
    return res.map((x) => x.result);
  };
  return {
    async obter(id) {
      const [v] = await chamar([["GET", `${PREFIXO}pedido:${id}`]]);
      return v ? JSON.parse(v) : null;
    },
    async salvar(p) {
      await chamar([
        ["SET", `${PREFIXO}pedido:${p.id}`, JSON.stringify(p)],
        ["ZADD", `${PREFIXO}pedidos`, String(Date.parse(p.criadoEm)), p.id],
      ]);
    },
    async listar(limite = 200) {
      const [ids] = await chamar([["ZREVRANGE", `${PREFIXO}pedidos`, "0", String(limite - 1)]]);
      if (!ids?.length) return [];
      const [vals] = await chamar([["MGET", ...ids.map((id) => `${PREFIXO}pedido:${id}`)]]);
      return vals.filter(Boolean).map((v) => JSON.parse(v));
    },
    async lerDado(chave) {
      const [v] = await chamar([["GET", `${PREFIXO}dado:${chave}`]]);
      return v ? JSON.parse(v) : null;
    },
    async gravarDado(chave, valor) {
      await chamar([["SET", `${PREFIXO}dado:${chave}`, JSON.stringify(valor)]]);
    },
    async lerCache(chave) {
      const [v] = await chamar([["GET", `${PREFIXO}cache:${chave}`]]);
      return v ? JSON.parse(v) : null;
    },
    async gravarCache(chave, valor, segundos) {
      await chamar([["SET", `${PREFIXO}cache:${chave}`, JSON.stringify(valor), "EX", String(segundos)]]);
    },
  };
}

function arquivo(caminho) {
  const ler = () => {
    try { return JSON.parse(fs.readFileSync(caminho, "utf8")); } catch { return { pedidos: {}, cache: {} }; }
  };
  const gravar = (d) => {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
    fs.writeFileSync(caminho, JSON.stringify(d, null, 2));
  };
  return {
    async obter(id) { return ler().pedidos[id] || null; },
    async salvar(p) { const d = ler(); d.pedidos[p.id] = p; gravar(d); },
    async listar(limite = 200) {
      return Object.values(ler().pedidos).sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm)).slice(0, limite);
    },
    async lerDado(chave) { return ler().dados?.[chave] ?? null; },
    async gravarDado(chave, valor) { const d = ler(); d.dados = { ...(d.dados || {}), [chave]: valor }; gravar(d); },
    async lerCache(chave) {
      const c = ler().cache[chave];
      return c && c.expira > Date.now() ? c.valor : null;
    },
    async gravarCache(chave, valor, segundos) { const d = ler(); d.cache[chave] = { valor, expira: Date.now() + segundos * 1000 }; gravar(d); },
  };
}

export function abrirBanco(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return redis(url, token);
  if (!env.VERCEL) return arquivo(env.ARQUIVO_PEDIDOS || path.join(process.cwd(), "data", "pedidos.json"));
  return null;
}
