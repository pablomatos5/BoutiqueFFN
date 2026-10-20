/* Limite de tentativas por endereço (IP), guardado no banco com validade.
   Sem banco (prévia/dev sem arquivo), não limita. */
import crypto from "node:crypto";

export function ipDe(req) {
  const bruto = String(req.headers?.["x-forwarded-for"] || req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "?");
  const ip = bruto.split(",")[0].trim();
  // guarda só um resumo do IP, não o IP em si
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

// devolve true se ainda pode; false se passou do limite
export async function dentroDoLimite(banco, nome, req, maximo, janelaSegundos) {
  if (!banco) return true;
  const chave = `limite:${nome}:${ipDe(req)}`;
  try {
    const usado = (await banco.lerCache(chave)) || 0;
    if (usado >= maximo) return false;
    await banco.gravarCache(chave, usado + 1, janelaSegundos);
  } catch { /* banco fora do ar: não bloqueia a venda */ }
  return true;
}
