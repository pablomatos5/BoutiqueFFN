/* Regras dos pedidos: etapas, mudanças de status, versão pública e rastreio dos Correios. */
import crypto from "node:crypto";
import { obterToken } from "./frete.js";

// Etapas da linha do tempo conforme a forma de entrega
export const ETAPAS = {
  correios: ["aprovado", "separando", "enviado", "saiu", "entregue"],
  local: ["aprovado", "separando", "saiu", "entregue"],
  retirada: ["aprovado", "separando", "pronto", "entregue"],
};
export const NOMES = {
  aguardando: "Aguardando pagamento",
  aprovado: "Pagamento aprovado",
  separando: "Separando seu pedido",
  enviado: "Enviado pelos Correios",
  saiu: "Saiu para entrega",
  pronto: "Pronto para retirar",
  entregue: "Entregue",
  cancelado: "Cancelado",
};
const NOME_ENTREGUE = { retirada: "Retirado na loja" };
export const STATUS_VALIDOS = Object.keys(NOMES);

export const nomeStatus = (p, s = p.status) => (s === "entregue" && NOME_ENTREGUE[p.entrega.tipo]) || NOMES[s];
export const novaChave = () => crypto.randomBytes(8).toString("hex");
const igual = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function criarPedido({ id, cliente, entrega, itens, subtotal, frete, total, pagamento, obs }) {
  const agora = new Date().toISOString();
  return {
    id,
    chave: novaChave(),
    criadoEm: agora,
    atualizadoEm: agora,
    status: "aguardando",
    cliente,
    entrega, // { tipo: "retirada"|"local"|"correios", descricao, endereco, cep, cidade, uf }
    itens, // [{ nome, cor, tamanho, qtd, preco }]
    subtotal,
    frete,
    total,
    obs: obs || "",
    pagamento, // { metodo, mpId, status, parcelas }
    rastreio: "",
    historico: [{ status: "aguardando", em: agora }],
  };
}

export function mudarStatus(p, status, nota) {
  if (!STATUS_VALIDOS.includes(status) || p.status === status) return false;
  const agora = new Date().toISOString();
  p.status = status;
  p.atualizadoEm = agora;
  p.historico.push({ status, em: agora, ...(nota ? { nota: String(nota).slice(0, 200) } : {}) });
  return true;
}

// Pagamento do Mercado Pago → status do pedido (só avança, nunca volta)
export function aplicarPagamento(p, mp) {
  p.pagamento = { ...p.pagamento, mpId: mp.id ?? p.pagamento?.mpId, status: mp.status, parcelas: mp.installments ?? p.pagamento?.parcelas };
  if (mp.status === "approved" && p.status === "aguardando") return mudarStatus(p, "aprovado"), true;
  if ((mp.status === "cancelled" || mp.status === "rejected" || mp.status === "refunded") && p.status === "aguardando") return mudarStatus(p, "cancelado", "Pagamento não concluído"), true;
  return false;
}

// O cliente pode ver o pedido com a chave do link ou com o CPF
export function podeVer(p, { chave, cpf }) {
  if (chave && p.chave && igual(String(chave), p.chave)) return true;
  const digitos = String(cpf || "").replace(/\D/g, "");
  return digitos.length === 11 && igual(digitos, p.cliente.cpf);
}

// O que o cliente vê: sem CPF, e-mail, telefone ou endereço completo
export function versaoPublica(p) {
  const etapas = ETAPAS[p.entrega.tipo] || ETAPAS.correios;
  return {
    id: p.id,
    criadoEm: p.criadoEm,
    status: p.status,
    nomeStatus: nomeStatus(p),
    primeiroNome: p.cliente.nome.split(" ")[0],
    entrega: { tipo: p.entrega.tipo, descricao: p.entrega.descricao, cidade: p.entrega.cidade, uf: p.entrega.uf },
    etapas: etapas.map((s) => ({ status: s, nome: nomeStatus(p, s), em: p.historico.find((h) => h.status === s)?.em || null })),
    historico: p.historico.map((h) => ({ status: h.status, nome: nomeStatus(p, h.status), em: h.em, nota: h.nota })),
    itens: p.itens.map(({ nome, cor, tamanho, qtd }) => ({ nome, cor, tamanho, qtd })),
    total: p.total,
    frete: p.frete,
    pagamento: { metodo: p.pagamento?.metodo, parcelas: p.pagamento?.parcelas },
    rastreio: p.rastreio || "",
  };
}

/* ---------- Rastreio dos Correios (API SRO Rastro, mesmo contrato do frete) ---------- */
export const codigoRastreioValido = (c) => /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(c);

export async function rastrear(codigo, env, banco) {
  if (!codigoRastreioValido(codigo)) return null;
  const emCache = await banco?.lerCache(`rastreio:${codigo}`).catch(() => null);
  if (emCache) return emCache;
  if (!env.CORREIOS_USUARIO || !env.CORREIOS_CODIGO_ACESSO || !env.CORREIOS_CARTAO_POSTAGEM) return null;

  const token = await obterToken(env);
  const r = await fetch(`https://api.correios.com.br/srorastro/v1/objetos/${codigo}?resultado=T`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Rastreio indisponível (${r.status})`);
  const dados = await r.json();
  const eventos = (dados.objetos?.[0]?.eventos || []).map((e) => {
    const end = e.unidade?.endereco || {};
    return { em: e.dtHrCriado, descricao: e.descricao, detalhe: e.detalhe || "", local: [end.cidade, end.uf].filter(Boolean).join(" - ") };
  });
  const resultado = { codigo, eventos, consultadoEm: new Date().toISOString() };
  await banco?.gravarCache(`rastreio:${codigo}`, resultado, 15 * 60).catch(() => {});
  return resultado;
}

// Os eventos dos Correios avançam o pedido sozinhos (saiu para entrega / entregue)
export function aplicarRastreio(p, rastreio) {
  if (!rastreio?.eventos?.length || p.entrega.tipo !== "correios") return false;
  const textos = rastreio.eventos.map((e) => e.descricao.toLowerCase());
  const ordem = ETAPAS.correios;
  let alvo = null;
  if (textos.some((t) => t.includes("entregue ao destinat"))) alvo = "entregue";
  else if (textos.some((t) => t.includes("saiu para entrega"))) alvo = "saiu";
  else if (textos.some((t) => t.includes("postado"))) alvo = "enviado";
  if (alvo && ordem.indexOf(alvo) > ordem.indexOf(p.status)) return mudarStatus(p, alvo, "Atualizado pelo rastreio dos Correios");
  return false;
}
