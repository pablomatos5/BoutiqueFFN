/* Boutique FFN · movimento e interações (entrada, rolagem, parallax, sacola, festa de folhas).
 * Com "reduzir movimento" ligado no aparelho, só o aviso de sacola funciona; nada se mexe. */
(() => {
  const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ponteiroFino = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const raiz = document.documentElement;
  const $ = (sel) => document.querySelector(sel);

  /* ---------- Aviso "adicionado à sacola" (vale sempre) ---------- */
  const toast = $("#toast");
  let timerToast;
  function mostrarToast(nome) {
    if (!toast) return;
    $("#toastNome").textContent = nome;
    toast.hidden = false;
    toast.classList.remove("is-saindo");
    clearTimeout(timerToast);
    timerToast = setTimeout(() => {
      toast.classList.add("is-saindo");
      setTimeout(() => (toast.hidden = true), reduzir ? 0 : 300);
    }, 3800);
  }

  document.addEventListener("ffn:adicionado", (e) => {
    const { origem, imagem, nome } = e.detail;
    mostrarToast(nome);
    if (!reduzir) voarParaSacola(origem, imagem);
  });

  /* ---------- Cabeçalho fixo: marca quando a página rolou ----------
     Vale sempre (também com "reduzir movimento"): além de encolher a marca, liga o fundo que
     cobre a área transparente do Safari no iOS 26 acima do cabeçalho. */
  const header = $(".header");
  let rolou = false;
  const conferirRolagem = () => {
    const agora = scrollY > 40;
    if (agora !== rolou) header?.classList.toggle("is-compacto", (rolou = agora));
  };
  addEventListener("scroll", conferirRolagem, { passive: true });
  conferirRolagem();

  if (reduzir) return;
  raiz.classList.add("anim");

  /* ---------- Folhas voando (sacola, frete grátis, pagamento aprovado) ---------- */
  const NS = "http://www.w3.org/2000/svg";
  function festaDeFolhas(x, y, quantidade = 10) {
    for (let i = 0; i < quantidade; i++) {
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "folha-voo");
      svg.setAttribute("aria-hidden", "true");
      const use = document.createElementNS(NS, "use");
      use.setAttribute("href", "#i-folha");
      svg.appendChild(use);
      svg.style.left = `${x}px`;
      svg.style.top = `${y}px`;
      if (i % 3 === 0) svg.style.fill = "#2f5d46";
      document.body.appendChild(svg);

      const ang = (Math.PI * 2 * i) / quantidade + Math.random() * 0.6;
      const dist = 50 + Math.random() * 70;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist - 40;
      const giro = (Math.random() - 0.5) * 540;
      svg
        .animate(
          [
            { transform: "translate(-50%, -50%) rotate(0deg) scale(.4)", opacity: 1 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${giro / 2}deg) scale(1)`, opacity: 1, offset: 0.45 },
            { transform: `translate(calc(-50% + ${dx * 1.3}px), calc(-50% + ${dy + 140}px)) rotate(${giro}deg) scale(.9)`, opacity: 0 },
          ],
          { duration: 1100 + Math.random() * 600, easing: "cubic-bezier(.2,.7,.3,1)" }
        )
        .finished.then(() => svg.remove());
    }
  }

  document.addEventListener("ffn:festa", (e) => {
    const alvo = e.detail?.alvo;
    if (!alvo) return;
    // espera o elemento aparecer (ex.: modal recém-aberto)
    requestAnimationFrame(() => {
      const r = alvo.getBoundingClientRect();
      festaDeFolhas(r.left + r.width / 2, r.top + r.height / 2, e.detail.quantidade || 12);
    });
  });

  /* ---------- A peça voa até a sacola ---------- */
  function voarParaSacola(origem, imagem) {
    const sacola = $("#abrirCarrinho").getBoundingClientRect();
    const x0 = origem.left + origem.width / 2;
    const y0 = origem.top + origem.height / 2;
    const x1 = sacola.left + sacola.width / 2;
    const y1 = sacola.top + sacola.height / 2;

    const bola = document.createElement("div");
    bola.className = "voo";
    bola.innerHTML = `<img src="${imagem || "assets/img/panda.webp"}" alt="">`;
    document.body.appendChild(bola);

    bola
      .animate(
        [
          { transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) scale(1.4)`, opacity: 0 },
          { transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) scale(1.2)`, opacity: 1, offset: 0.12 },
          { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 120}px) translate(-50%, -50%) scale(.85) rotate(-12deg)`, offset: 0.55 },
          { transform: `translate(${x1}px, ${y1}px) translate(-50%, -50%) scale(.2) rotate(8deg)`, opacity: 0.7 },
        ],
        { duration: 900, easing: "cubic-bezier(.45,0,.25,1)" }
      )
      .finished.then(() => {
        bola.remove();
        const btn = $("#abrirCarrinho");
        btn.classList.remove("pulo");
        void btn.offsetWidth;
        btn.classList.add("pulo");
        festaDeFolhas(x1, y1, 8);
      });
  }

  // contador da sacola "pula" quando muda
  const contador = $("#contadorCarrinho");
  if (contador) {
    new MutationObserver(() => {
      contador.classList.remove("pop");
      void contador.offsetWidth;
      contador.classList.add("pop");
    }).observe(contador, { childList: true });
  }

  /* ---------- Animações contínuas só rodam com a parte na tela ---------- */
  // fora da tela elas ficam pausadas: o celular não gasta bateria nem quadros com o que ninguém vê
  const pausaveis = document.querySelectorAll(".topbar, .hero, .divisor-bambu, .mapa, .footer, .lupo-banner, .pix-codigo");
  const vigia = new IntersectionObserver((entradas) => {
    for (const e of entradas) e.target.toggleAttribute("data-visivel", e.isIntersecting);
  });
  pausaveis.forEach((el) => { el.setAttribute("data-pausa", ""); vigia.observe(el); });

  /* ---------- Revelar ao rolar ---------- */
  const observador = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("visivel");
        observador.unobserve(e.target);
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  function revelar(elementos, passo = 90) {
    [...elementos].forEach((el, i) => {
      if (el.classList.contains("revelar")) return;
      el.classList.add("revelar");
      el.style.setProperty("--atraso", `${(i % 4) * passo}ms`);
      observador.observe(el);
    });
  }

  revelar(document.querySelectorAll(".section-head, .lupo-banner, .visite__text, .mapa, .divisor-bambu"), 0);
  revelar(document.querySelectorAll(".cat"), 80);
  revelar(document.querySelectorAll(".passos li"), 160);
  revelar(document.querySelectorAll(".finalizar__etapas > .etapa, .resumo-pedido, .finalizar__vazio"), 90);

  // cards da vitrine: anima de novo a cada filtro/busca
  const grade = $("#gridProdutos");
  if (grade) {
    const revelarCards = () => revelar(grade.querySelectorAll(".card"), 70);
    revelarCards();
    new MutationObserver(revelarCards).observe(grade, { childList: true });
  }

  if (!ponteiroFino) return;

  /* ---------- Parallax com o mouse na abertura ---------- */
  const hero = $(".hero");
  hero?.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    hero.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    hero.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  });
  hero?.addEventListener("pointerleave", () => {
    hero.style.setProperty("--mx", 0);
    hero.style.setProperty("--my", 0);
  });

  // panda da faixa Lupo acompanha o mouse
  const lupo = $(".lupo-banner");
  lupo?.addEventListener("pointermove", (e) => {
    const r = lupo.getBoundingClientRect();
    lupo.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    lupo.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  });
  lupo?.addEventListener("pointerleave", () => {
    lupo.style.setProperty("--mx", 0);
    lupo.style.setProperty("--my", 0);
  });

  /* ---------- Cards inclinam com o mouse ---------- */
  grade?.addEventListener("pointermove", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`);
    card.style.setProperty("--rx", `${-((e.clientY - r.top) / r.height - 0.5) * 8}deg`);
  });
  grade?.addEventListener(
    "pointerout",
    (e) => {
      const card = e.target.closest(".card");
      if (card && !card.contains(e.relatedTarget)) {
        card.style.removeProperty("--rx");
        card.style.removeProperty("--ry");
      }
    }
  );
})();
