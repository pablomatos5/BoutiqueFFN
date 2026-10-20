/*
 * Aviso de pedido novo para a loja pelo Telegram (grátis, chega como notificação no celular).
 *   TELEGRAM_BOT_TOKEN  token do bot (crie com o @BotFather no Telegram)
 *   TELEGRAM_CHAT_ID    id da conversa que recebe os avisos (veja o README)
 * Sem as duas variáveis, não faz nada.
 */
const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function avisarLoja(p, env = process.env, site = env.SITE_URL || "") {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return false;
  const linhas = [
    `🐼 Pedido novo pago! ${p.id}`,
    ``,
    ...p.itens.map((i) => `• ${i.qtd}x ${i.nome} (${i.cor}, ${i.tamanho})`),
    ``,
    `💰 ${brl(p.total)} · ${p.pagamento?.metodo || ""}${p.pagamento?.parcelas > 1 ? ` em ${p.pagamento.parcelas}x` : ""}`,
    `🚚 ${p.entrega.descricao}`,
    `👤 ${p.cliente.nome}${p.cliente.telefone ? ` · ${p.cliente.telefone}` : ""}`,
    p.obs ? `📝 ${p.obs}` : "",
    site ? `\nAbrir o painel: ${site.replace(/\/$/, "")}/painel.html` : "",
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "");
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // texto simples: nome ou observação do cliente com símbolos não quebram a mensagem
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: linhas.join("\n"), disable_web_page_preview: true }),
    });
    if (!r.ok) console.error("[aviso] Telegram respondeu", r.status, await r.text());
    return r.ok;
  } catch (e) {
    console.error("[aviso] Telegram", e.message);
    return false;
  }
}
