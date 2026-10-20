/* Cupons de desconto: guardados no banco e editados no painel da loja. */
export const normalizarCodigo = (c) => String(c || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);

export async function listarCupons(banco) {
  return (await banco?.lerDado("cupons")) || [];
}

// devolve { cupom, desconto } ou { erro }
export async function aplicarCupom(banco, codigo, subtotal) {
  const c = normalizarCodigo(codigo);
  if (!c) return { erro: "Digite o código do cupom" };
  const cupom = (await listarCupons(banco)).find((x) => x.codigo === c);
  if (!cupom || !cupom.ativo) return { erro: "Cupom inválido" };
  if (cupom.ate && new Date(`${cupom.ate}T23:59:59-03:00`) < new Date()) return { erro: "Esse cupom já expirou" };
  if (cupom.limite && (cupom.usos || 0) >= cupom.limite) return { erro: "Esse cupom já esgotou" };
  if (cupom.minimo && subtotal < cupom.minimo) return { erro: `Cupom válido para compras a partir de R$ ${cupom.minimo.toFixed(2).replace(".", ",")}` };
  const desconto = cupom.tipo === "valor" ? Math.min(cupom.valor, subtotal) : Math.round(subtotal * cupom.valor) / 100;
  return { cupom, desconto: Math.round(desconto * 100) / 100 };
}

export async function registrarUso(banco, codigo) {
  const lista = await listarCupons(banco);
  const cupom = lista.find((x) => x.codigo === normalizarCodigo(codigo));
  if (!cupom) return;
  cupom.usos = (cupom.usos || 0) + 1;
  await banco.gravarDado("cupons", lista);
}

export function validarCupom(c) {
  const codigo = normalizarCodigo(c.codigo);
  const valor = Number(c.valor);
  if (codigo.length < 3) return "O código precisa ter pelo menos 3 letras ou números";
  if (!["porcentagem", "valor"].includes(c.tipo)) return "Escolha porcentagem ou valor";
  if (!(valor > 0) || (c.tipo === "porcentagem" && valor > 90)) return "Desconto inválido (porcentagem até 90%)";
  return null;
}
