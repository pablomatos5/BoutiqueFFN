/* Testes das funções do servidor (api/). Rode com: npm test */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { ambiente, simularApis, chamar, clienteBase, itemBase } from "./ajuda.js";

let frete, pagamento, pedido, painel, webhook, cupom;
before(async () => {
  frete = (await import("../api/frete.js")).default;
  pagamento = (await import("../api/pagamento.js")).default;
  pedido = (await import("../api/pedido.js")).default;
  painel = (await import("../api/painel.js")).default;
  webhook = (await import("../api/webhook-mp.js")).default;
  cupom = (await import("../api/cupom.js")).default;
  // a senha errada do painel espera 800 ms; nos testes, sem espera
  const original = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => original(fn, Math.min(ms, 5));
});

const pagar = (corpo, env, headers = {}) => chamar(pagamento, { method: "POST", body: corpo, headers }, env);
const entrarNoPainel = async (env) => ({ authorization: `Bearer ${(await chamar(painel, { method: "POST", url: "/api/painel?acao=entrar", body: { senha: env.PAINEL_SENHA } }, env)).corpo.token}` });

test("frete: PAC e SEDEX ordenados pelo preço; CEP inválido recusado", async () => {
  simularApis();
  const env = ambiente();
  const r = await chamar(frete, { url: "/api/frete?cep=01001-000&peso=600" }, env);
  assert.equal(r.status, 200);
  assert.deepEqual(r.corpo.opcoes.map((o) => o.servico), ["PAC", "SEDEX"]);
  assert.equal((await chamar(frete, { url: "/api/frete?cep=123" }, env)).status, 400);
});

test("pagamento: preço vem do catálogo, não do navegador", async () => {
  const estado = simularApis();
  const env = ambiente();
  const r = await pagar({ ...clienteBase, pedido: "FFN-T1", entrega: "retirada", metodo: "cartao", cartao: { token: "t", payment_method_id: "visa", installments: 1 }, itens: [{ ...itemBase, preco: 0.01 }] }, env);
  assert.equal(r.status, 200);
  assert.equal(estado.ultimoPagamento.transaction_amount, 179.8);
});

test("pagamento: frete dos Correios somado e Cametá grátis", async () => {
  const estado = simularApis();
  const env = ambiente();
  await pagar({ ...clienteBase, pedido: "FFN-T2", entrega: "entrega", cep: "01001000", servico: "03220", endereco: { rua: "Praça", numero: "1" }, metodo: "cartao", cartao: { token: "t", payment_method_id: "visa", installments: 1 }, itens: [itemBase] }, env);
  assert.equal(estado.ultimoPagamento.transaction_amount, 238.7);
  await pagar({ ...clienteBase, pedido: "FFN-T3", entrega: "entrega", cep: "68400000", endereco: { rua: "Rua", numero: "1" }, metodo: "cartao", cartao: { token: "t", payment_method_id: "visa", installments: 1 }, itens: [itemBase] }, env);
  assert.equal(estado.ultimoPagamento.transaction_amount, 179.8);
});

test("pagamento: valida CPF, e-mail, item e parcelas", async () => {
  simularApis();
  const env = ambiente();
  const base = { ...clienteBase, entrega: "retirada", metodo: "pix", itens: [itemBase] };
  assert.equal((await pagar({ ...base, cpf: "111.111.111-11" }, env)).corpo.erro, "Informe um CPF válido");
  assert.equal((await pagar({ ...base, email: "x" }, env)).corpo.erro, "Informe um e-mail válido");
  assert.equal((await pagar({ ...base, itens: [{ ...itemBase, cor: "Roxo" }] }, env)).corpo.erro, "Item inválido na sacola");
  assert.equal((await pagar({ ...base, metodo: "cartao", cartao: { token: "t", payment_method_id: "visa", installments: 99 } }, env)).corpo.erro, "Dados do cartão incompletos");
});

test("pagamento: cartão recusado traz mensagem clara e não vira pedido", async () => {
  simularApis();
  const env = ambiente();
  const r = await pagar({ ...clienteBase, pedido: "FFN-REC", entrega: "retirada", metodo: "cartao", cartao: { token: "RECUSA", payment_method_id: "visa", installments: 1 }, itens: [itemBase] }, env);
  assert.equal(r.corpo.status, "rejected");
  assert.match(r.corpo.mensagem, /limite/);
  assert.equal(JSON.parse(fs.readFileSync(env.ARQUIVO_PEDIDOS, "utf8")).pedidos["FFN-REC"], undefined);
});

test("pedido: Pix gerado → webhook assinado aprova → aviso no Telegram uma vez só", async () => {
  const estado = simularApis();
  const env = ambiente({ MP_WEBHOOK_SECRET: "segredo", TELEGRAM_BOT_TOKEN: "bot", TELEGRAM_CHAT_ID: "1" });
  const r = await pagar({ ...clienteBase, pedido: "FFN-PIX", entrega: "retirada", metodo: "pix", itens: [itemBase] }, env);
  assert.equal(r.corpo.status, "pending");
  const id = String(r.corpo.id);
  estado.pagamentos[id].status = "approved";
  const ts = "1700000000";
  const v1 = crypto.createHmac("sha256", "segredo").update(`id:${id};request-id:r1;ts:${ts};`).digest("hex");
  const req = { method: "POST", url: `/api/webhook-mp?data.id=${id}&type=payment`, body: { type: "payment", data: { id } } };
  assert.equal((await chamar(webhook, req, env)).status, 401, "sem assinatura é recusado");
  const assinado = { ...req, headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "r1" } };
  assert.equal((await chamar(webhook, assinado, env)).status, 200);
  await chamar(webhook, assinado, env);
  assert.equal(JSON.parse(fs.readFileSync(env.ARQUIVO_PEDIDOS, "utf8")).pedidos["FFN-PIX"].status, "aprovado");
  assert.equal(estado.enviados.length, 1);
});

test("acompanhar: chave ou CPF; nunca expõe dados pessoais; limita tentativas", async () => {
  simularApis();
  const env = ambiente();
  const r = await pagar({ ...clienteBase, pedido: "FFN-ACOMP", entrega: "retirada", metodo: "cartao", cartao: { token: "t", payment_method_id: "visa", installments: 1 }, itens: [itemBase] }, env);
  const comChave = await chamar(pedido, { url: `/api/pedido?pedido=FFN-ACOMP&chave=${r.corpo.chave}` }, env);
  assert.equal(comChave.status, 200);
  const texto = JSON.stringify(comChave.corpo);
  assert.ok(!texto.includes("52998224725") && !texto.includes("ana@exemplo.com") && !texto.includes("98510"));
  assert.equal((await chamar(pedido, { url: "/api/pedido?pedido=FFN-ACOMP&chave=errada" }, env)).status, 404);
  assert.equal((await chamar(pedido, { method: "POST", body: { pedido: "FFN-ACOMP", cpf: "52998224725" } }, env)).status, 200);
  let ultimo;
  for (let i = 0; i < 9; i++) ultimo = await chamar(pedido, { method: "POST", body: { pedido: "FFN-ACOMP", cpf: "11144477735" } }, env);
  assert.equal(ultimo.status, 429);
});

test("painel: senha, limite de tentativas, rastreio marca enviado e Correios avançam sozinhos", async () => {
  const estado = simularApis();
  const env = ambiente();
  assert.equal((await chamar(painel, { url: "/api/painel?acao=pedidos" }, env)).status, 401);
  const H = await entrarNoPainel(env);
  const r = await pagar({ ...clienteBase, pedido: "FFN-ENV", entrega: "entrega", cep: "01001000", endereco: { rua: "R", numero: "1" }, metodo: "cartao", cartao: { token: "t", payment_method_id: "visa", installments: 1 }, itens: [itemBase] }, env);
  const att = (corpo) => chamar(painel, { method: "POST", url: "/api/painel?acao=atualizar", headers: H, body: { id: "FFN-ENV", ...corpo } }, env);
  assert.equal((await att({ rastreio: "123" })).status, 400);
  assert.equal((await att({ rastreio: "ab123456789br" })).corpo.pedido.status, "enviado");
  estado.eventosCorreios = [{ descricao: "Objeto saiu para entrega ao destinatário", dtHrCriado: "2026-10-23T08:00:00", unidade: { endereco: { cidade: "SP", uf: "SP" } } }];
  const visto = await chamar(pedido, { url: `/api/pedido?pedido=FFN-ENV&chave=${r.corpo.chave}` }, env);
  assert.equal(visto.corpo.pedido.status, "saiu");
  const tentativas = [];
  for (let i = 0; i < 11; i++) tentativas.push((await chamar(painel, { method: "POST", url: "/api/painel?acao=entrar", body: { senha: "x" }, headers: { "x-forwarded-for": "9.9.9.9" } }, env)).status);
  assert.equal(tentativas.at(-1), 429);
});

test("cupons: criados no painel, conferidos no servidor e contados só quando pagos", async () => {
  const estado = simularApis();
  const env = ambiente();
  const H = await entrarNoPainel(env);
  const salvar = (c) => chamar(painel, { method: "POST", url: "/api/painel?acao=salvarCupom", headers: H, body: c }, env);
  assert.equal((await salvar({ codigo: "XX1", tipo: "porcentagem", valor: 95 })).status, 400);
  await salvar({ codigo: "ANIVERSARIO40", tipo: "porcentagem", valor: 40 });
  await salvar({ codigo: "UMAVEZ", tipo: "valor", valor: 15, limite: 1 });
  await salvar({ codigo: "VELHO", tipo: "valor", valor: 10, ate: "2020-01-01" });
  assert.equal((await chamar(cupom, { url: "/api/cupom?codigo=velho&subtotal=100" }, env)).corpo.erro, "Esse cupom já expirou");
  const base = { ...clienteBase, entrega: "retirada", metodo: "cartao", cartao: { token: "t", payment_method_id: "visa", installments: 1 }, itens: [itemBase] };
  await pagar({ ...base, pedido: "FFN-C1", cupom: "aniversario40" }, env);
  assert.equal(estado.ultimoPagamento.transaction_amount, 107.88);
  await pagar({ ...base, pedido: "FFN-C2", cupom: "UMAVEZ" }, env);
  assert.equal((await pagar({ ...base, pedido: "FFN-C3", cupom: "UMAVEZ" }, env)).corpo.erro, "Cupom: Esse cupom já esgotou");
  // Pix gerado e não pago não gasta o cupom
  await pagar({ ...base, pedido: "FFN-C4", metodo: "pix", cupom: "ANIVERSARIO40" }, env);
  const lista = (await chamar(painel, { url: "/api/painel?acao=cupons", headers: H }, env)).corpo.cupons;
  assert.equal(lista.find((c) => c.codigo === "ANIVERSARIO40").usos, 1);
});

test("pagamento: limite de 15 tentativas a cada 10 minutos por endereço", async () => {
  simularApis();
  const env = ambiente();
  const codigos = [];
  for (let i = 0; i < 16; i++) codigos.push((await pagar({}, env, { "x-forwarded-for": "8.8.8.8" })).status);
  assert.equal(codigos.at(-1), 429);
  assert.equal((await pagar({}, env, { "x-forwarded-for": "7.7.7.7" })).status, 400);
});
