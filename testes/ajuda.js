/* Utilidades dos testes: banco em arquivo temporário, Mercado Pago/Correios/ViaCEP simulados. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function ambiente(extra = {}) {
  const arquivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ffn-")), "pedidos.json");
  return { MP_ACCESS_TOKEN: "TESTE", MP_PUBLIC_KEY: "PK", PAINEL_SENHA: "senha-teste", CORREIOS_USUARIO: "u", CORREIOS_CODIGO_ACESSO: "c", CORREIOS_CARTAO_POSTAGEM: "1", ARQUIVO_PEDIDOS: arquivo, ...extra };
}

// Simula as APIs externas. `estado` permite mudar respostas durante o teste.
export function simularApis(estado = {}) {
  estado.pagamentos ??= {};
  estado.enviados ??= [];
  globalThis.fetch = async (url, opt = {}) => {
    const json = (o, status = 200) => ({ ok: status < 300, status, json: async () => o, text: async () => JSON.stringify(o) });
    if (url.includes("viacep")) return json(url.includes("68400000") ? { localidade: "Cametá", uf: "PA" } : { localidade: "São Paulo", uf: "SP" });
    if (url.includes("/token/")) return json({ token: "TK", expiraEm: new Date(Date.now() + 3600e3).toISOString() });
    if (url.includes("/preco/v1/nacional/03298")) return json({ pcFinal: "32,40" });
    if (url.includes("/preco/v1/nacional/03220")) return json({ pcFinal: "58,90" });
    if (url.includes("/prazo/")) return json({ prazoEntrega: 5 });
    if (url.includes("srorastro")) return json({ objetos: [{ eventos: estado.eventosCorreios || [] }] });
    if (url.includes("telegram")) { estado.enviados.push(JSON.parse(opt.body)); return json({ ok: true }); }
    if (url.endsWith("/v1/payments")) {
      const b = JSON.parse(opt.body);
      estado.ultimoPagamento = b;
      const id = 100 + Object.keys(estado.pagamentos).length;
      const status = b.payment_method_id === "pix" ? "pending" : b.token === "RECUSA" ? "rejected" : "approved";
      estado.pagamentos[id] = { id, status, status_detail: status === "rejected" ? "cc_rejected_insufficient_amount" : "", external_reference: b.external_reference, installments: b.installments || 1 };
      return json({ ...estado.pagamentos[id], point_of_interaction: b.payment_method_id === "pix" ? { transaction_data: { qr_code: "PIX", qr_code_base64: "QR" } } : undefined, date_of_expiration: b.date_of_expiration });
    }
    const m = url.match(/\/v1\/payments\/(\d+)/);
    if (m) return estado.pagamentos[m[1]] ? json(estado.pagamentos[m[1]]) : json({}, 404);
    throw new Error(`URL não simulada: ${url}`);
  };
  return estado;
}

// Chama uma função de api/ como a Vercel chamaria
export function chamar(handler, req, env) {
  return new Promise((ok) => {
    const res = { statusCode: 200, setHeader() {}, end(b) { ok({ status: res.statusCode, corpo: JSON.parse(b) }); } };
    handler({ headers: {}, url: "/", method: "GET", ...req }, res, env);
  });
}

export const clienteBase = { nome: "Ana Souza", email: "ana@exemplo.com", cpf: "529.982.247-25", telefone: "(91) 98510-6107" };
export const itemBase = { id: "short-sarja-madrid", cor: "Preto", tamanho: "M", qtd: 2 };
