# Boutique FFN: estudo de imagem e identidade

Fonte: perfil [@boutiqueficafeionunca_](https://www.instagram.com/boutiqueficafeionunca_/), levantado em outubro de 2026.

## Quem é

| | |
|---|---|
| Nome | **Boutique FFN**, sigla de **Fica Feio Nunca** |
| Cidade | Cametá-PA |
| Modelo | Loja física e virtual (vendas pelo direct e WhatsApp) |
| Público | Moda masculina (foco principal) e feminina |
| Endereço | Rua 13 de Maio, Centro, em frente ao Hotel Aricurá |
| WhatsApp | (91) 98510-6107 · `wa.me/5591985106107` |
| Audiência | cerca de 1,9 mil seguidores e mais de 1,6 mil posts (postagem frequente) |
| Bio | "Seja exclusivo, entre em contato 👇" |

## Elementos visuais

- **Fachada / logo principal:** fundo verde-noite quase preto com o logotipo **dourado metálico**: "BOUTIQUE" em caixa alta serifada, o monograma **FFN** geométrico e grande, e "FICAFEIONUNCA" sublinhado. É a marca "oficial" e o que mais transmite valor. O site usa essa combinação como base.
- **Mascote panda:** aparece na fachada (ilustração em preto e branco, estilo pixel/streetwear) e na foto de perfil. É o elemento simpático e reconhecível da marca.
- **Foto de perfil rosa:** panda branco sobre magenta (`#D1095F`) com o laço rosa, ou seja, versão temática do **Outubro Rosa**, não a cor-base da marca. O site pode ganhar um "modo campanha" para essas datas.
- **Posts de produto:** fotos reais, sem estúdio, com as peças dobradas sobre mesa ou balcão e várias cores lado a lado. Vídeos/reels com a vitrine e modelos locais.
- **Posts institucionais:** datas locais e religiosas (Círio de Nazaré), aniversário da loja com promoções fortes ("40% OFF", fundo escuro com amarelo/dourado).

## Tom de voz

- Direto, animado, com emojis 🔥😎🤌💙🛍️ e caixa alta nos ganchos ("🔥 NOVIDADE!").
- Bordões: **"Na Boutique FFN, seu estilo fala mais alto!"**, **"Fica feio nunca"**, "Chama no direct e garanta o seu antes que acabe!", "Seja exclusivo".
- Sempre reforça: qualidade, caimento, conforto + estilo, tamanhos disponíveis (P ao GG) e o endereço físico.
- Proximidade com a cidade: devoção a Nossa Senhora de Nazaré, clientes marcados nos destaques.

## Mix de produtos observado

- **Shorts de sarja:** Short Sarja **Madrid** (liso, sarja acetinada, várias cores) e **Short de Sarja Texturizado** (canelado), do P ao GG.
- **Shorts de linho** e **bermudas** (destaques do perfil).
- **Lupo:** meias e underwear (destaques "Meias LUPO" e "Clientes Lupo").
- **Peças femininas:** conjuntos fitness (top + legging), vestidos.
- Camisas básicas, estampadas e regatas (citadas como combinação dos shorts).

## Decisões para o site

| Elemento | Escolha |
|---|---|
| Cores | Verde-noite `#0E1613`, dourado `#C9A14A` (gradiente metálico), creme `#F6F3EC` |
| Tipografia | **Cinzel** (serifa em caixa alta, ecoa o "BOUTIQUE" da fachada) + **Montserrat** (texto e o monograma FFN em itálico pesado) |
| Mascote | Panda como ícone, favicon e card das peças ainda sem foto |
| Compra | Sacola no site → pedido pronto no WhatsApp, que é como a loja já vende hoje |
| Entrega | Retirada na loja ou entrega grátis em Cametá; Correios (PAC/SEDEX) para o resto do Brasil |
| Pagamento | Pix e cartão dentro do próprio site (Checkout Transparente do Mercado Pago); WhatsApp como alternativa |

## Pendências com o cliente

1. **Preços reais** de cada peça (os do site são provisórios).
2. **Logo em vetor** (SVG/AI/PDF) do FFN. O panda foi vetorizado da foto de perfil da loja (`assets/img/panda.svg` e `panda-solo.svg`); com o arquivo original ele fica ainda mais fiel.
3. **Fotos de produto** para as peças sem imagem (fundo neutro, mesmo ângulo).
4. **Credenciais do contrato com os Correios** (usuário, código de acesso da API e cartão de postagem) para ativar o cálculo do frete.
5. **Public Key e Access Token do Mercado Pago** (Checkout Transparente) e uma chave Pix cadastrada na conta, para ativar o pagamento no site.
6. **Senha do painel da loja** e criação do banco (Vercel KV) para os pedidos.
7. **Razão social, CNPJ e e-mail** para o rodapé e as páginas legais (`js/loja.js`), e confirmar a política de trocas.
8. **Medidas reais** das peças para o guia de medidas.
9. **Bot do Telegram** (ou outro canal) para receber o aviso de pedido pago.
10. Domínio desejado (ex.: `boutiqueffn.com.br`).
