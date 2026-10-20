/*
 * GET /api/config
 * Configuração pública para o navegador. A Public Key do Mercado Pago é feita para ficar
 * no navegador (ela só cria tokens de cartão); o Access Token nunca sai do servidor.
 */
import { responder } from "./frete.js";

export default function handler(req, res, env = process.env) {
  res.setHeader("Cache-Control", "no-store");
  return responder(res, 200, {
    mercadoPago: env.MP_PUBLIC_KEY && env.MP_ACCESS_TOKEN ? { publicKey: env.MP_PUBLIC_KEY } : null,
  });
}
