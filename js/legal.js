/* Preenche as páginas legais com os dados de js/loja.js */
(() => {
  const valores = {
    ...LOJA,
    whatsappLink: `https://wa.me/${LOJA.whatsapp}`,
    emailLink: LOJA.email ? `mailto:${LOJA.email}` : "",
  };
  document.querySelectorAll("[data-loja]").forEach((el) => {
    const v = valores[el.dataset.loja];
    if (v === undefined || v === "") return;
    if (el.tagName === "A") el.href = v;
    else el.textContent = v;
  });
  // trechos que só aparecem se o dado existir (ex.: e-mail)
  document.querySelectorAll("[data-loja-se]").forEach((el) => { el.hidden = !LOJA[el.dataset.lojaSe]; });
})();
