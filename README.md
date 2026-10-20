# Boutique FFN · Fica Feio Nunca

Site de vendas da Boutique FFN (Cametá-PA): vitrine com filtros e busca, sacola, frete (grátis em Cametá, Correios para o resto do Brasil), pagamento com Pix e cartão dentro do próprio site (Checkout Transparente do Mercado Pago) e aviso do pedido no WhatsApp da loja.

O estudo de identidade visual que guiou o layout está em [`docs/identidade-visual.md`](docs/identidade-visual.md).

## Estrutura

```
index.html          loja: abertura, categorias, vitrine, Lupo, como comprar, endereço (?produto=ID abre a peça)
finalizar.html      página de finalizar pedido: sacola, dados, entrega/frete e pagamento
acompanhar.html     o cliente acompanha o pedido (linha do tempo e rastreio dos Correios)
painel.html         painel da loja (com senha): pedidos, status, rastreio, aviso no WhatsApp e cupons
trocas.html         política de trocas e devoluções
privacidade.html    política de privacidade (LGPD)
css/styles.css      estilos (cores e fontes no topo, em :root; temas de campanha no fim)
js/loja.js          DADOS DA LOJA: razão social, CNPJ, contatos, prazos de troca e campanha
js/produtos.js      catálogo: edite aqui produtos, preços, cores e tamanhos
js/comum.js         funções usadas pelas duas páginas (sacola salva no navegador, preços, itens)
js/app.js           loja: vitrine, filtros, detalhe do produto e gaveta da sacola
js/finalizar.js     finalizar: CEP/frete, validação, confirmação e WhatsApp
js/pagamento.js     aba de pagamento: Pix (QR e copia e cola) e cartão (campos seguros do Mercado Pago)
js/acompanhar.js    acompanhar pedido
js/painel.js        painel da loja
js/efeitos.js       animações e interações (pausadas fora da tela; desligadas com "reduzir movimento")
api/frete.js        função de servidor que consulta PAC e SEDEX na API dos Correios
api/pagamento.js    função de servidor que cria o pagamento (Pix ou cartão) e consulta a situação do Pix
api/config.js       entrega ao navegador a Public Key do Mercado Pago
api/pedido.js       consulta pública do pedido (link com chave secreta ou número + CPF)
api/painel.js       login e ações do painel da loja
api/webhook-mp.js   aviso automático do Mercado Pago (pedido pago com o site fechado)
api/cupom.js        confere um cupom para mostrar o desconto na tela
api/_cupons.js      regras dos cupons
api/_avisos.js      aviso de pedido pago para a loja no Telegram
api/_limite.js      limite de tentativas por endereço
api/_db.js          banco dos pedidos (Vercel KV/Upstash, ou arquivo no npm run dev)
api/_pedidos.js     etapas dos pedidos e rastreio dos Correios
server.js           servidor local (site + funções de api/ + cabeçalhos de segurança)
seguranca.json      cabeçalhos de segurança (iguais aos do vercel.json)
testes/             testes automáticos do servidor (npm test)
assets/img/         fotos e o panda
```

Não há build nem dependências: HTML, CSS e JavaScript puro, mais uma função Node (18+) para o frete.

## Rodar localmente

```bash
cp .env.example .env   # preencha as credenciais (todas opcionais para testar)
npm run dev            # http://localhost:8000
npm test               # testes do servidor: frete, pagamento, pedidos, painel, cupons, limites
```

## Antes de publicar: dados da loja

Preencha `js/loja.js`: **razão social, CNPJ e e-mail** aparecem no rodapé e nas páginas legais (a lei do comércio eletrônico, Decreto 7.962/2013, exige razão social, CNPJ, endereço e contato no site). Confira também os prazos de troca e o texto de `trocas.html` com a loja.

Ao ter o domínio definitivo, troque `assets/img/compartilhar.jpg` em `og:image` (no `index.html`) pelo endereço completo (`https://.../assets/img/compartilhar.jpg`), para a imagem aparecer ao compartilhar o link no WhatsApp.

## Entrega e frete

- **Retirada na loja:** grátis.
- **Cametá-PA:** entrega grátis. O CEP é consultado no ViaCEP, que também preenche rua e bairro.
- **Outras cidades:** `api/frete.js` consulta **PAC e SEDEX** na API oficial dos Correios (`api.correios.com.br`) com o peso da sacola (campo `peso` de cada produto, padrão 300 g) e uma caixa de 30×20×10 cm. O cliente escolhe o serviço e o valor entra no total e na mensagem do WhatsApp.
- **Se a API não responder** (credenciais faltando, Correios fora do ar, prévia estática sem servidor), o pedido continua com o frete marcado como *a combinar*.

### Credenciais dos Correios

A API exige **contrato com os Correios** (pessoa jurídica). No portal [Meu Correios / CWS](https://cws.correios.com.br) a loja gera:

| Variável | O que é |
|---|---|
| `CORREIOS_USUARIO` | usuário do Meu Correios (geralmente o CNPJ) |
| `CORREIOS_CODIGO_ACESSO` | código de acesso à API gerado no CWS |
| `CORREIOS_CARTAO_POSTAGEM` | número do cartão de postagem do contrato |
| `CORREIOS_CONTRATO`, `CORREIOS_DR` | opcionais, número do contrato e da diretoria regional |
| `CEP_ORIGEM` | CEP de onde sai a encomenda (padrão 68400000) |
| `CORREIOS_SERVICOS` | códigos dos serviços do contrato (padrão `03298:PAC,03220:SEDEX`) |

Confira no contrato os códigos de PAC e SEDEX, que podem variar.

## Pagamento (dentro do site)

O cliente paga **sem sair do site**, na aba de pagamento da página de finalizar, usando o **Checkout Transparente** do Mercado Pago:

- **Pix:** `api/pagamento.js` cria o pagamento e o site mostra o QR Code e o código copia e cola, com contagem regressiva (`PIX_MINUTOS`, padrão 30). A página consulta a situação a cada 5 segundos e mostra a confirmação sozinha quando o Pix é pago. Se a sacola ou o frete mudarem, o Pix antigo deixa de valer e o cliente gera outro.
- **Cartão (crédito e débito):** número, validade e CVV são **campos seguros do Mercado Pago** (iframes) montados dentro do formulário da loja, com o visual do site. O navegador gera um token e só ele vai para o servidor: a loja nunca vê nem guarda o número do cartão. Bandeira e parcelas vêm do Mercado Pago a partir dos primeiros dígitos. Recusas aparecem com mensagem clara ("cartão sem limite", "confira o CVV"…), e o cliente pode tentar de novo ou trocar para Pix.
- **Segurança:** preços e frete são recalculados no servidor, CPF e e-mail são validados, cada tentativa leva uma chave de idempotência (sem cobrança duplicada) e o identificador do aparelho (`security.js`) vai para a análise antifraude do Mercado Pago.
- **Confirmação:** aparece na própria página, com número do pedido, forma de pagamento e um botão para avisar a loja no WhatsApp. No painel do Mercado Pago cada pagamento tem o número do pedido (`FFN-...`) e os dados de entrega.

### Ativar (receber a API)

Em [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers) → *Suas integrações* → criar aplicação (*Pagamentos online* → *Checkout Transparente*) → *Credenciais*:

| Variável | Onde fica |
|---|---|
| `MP_PUBLIC_KEY` | Public Key (vai para o navegador; só serve para criar o token do cartão) |
| `MP_ACCESS_TOKEN` | Access Token (fica só no servidor) |

Use primeiro as credenciais **de teste** com os [cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-test/test-cards) e depois as **de produção**. Para receber Pix, a conta Mercado Pago precisa ter uma **chave Pix cadastrada**.

**Sem as credenciais** (ou na prévia estática, sem servidor) a aba funciona em **modo demonstração**: aparece o aviso "Modo demonstração", os campos do cartão são comuns, o Pix mostra um QR de exemplo e nada é cobrado nem enviado. Assim a loja pode ver e aprovar o fluxo antes de ligar a API.

## Pedidos: acompanhamento e painel da loja

**Como o pedido nasce:** quando o cliente gera o Pix ou o cartão é aprovado, o pedido é gravado no banco. Ele passa para *Pagamento aprovado* sozinho: no cartão, na hora; no Pix, quando a página vê o pagamento ou quando o Mercado Pago avisa (`api/webhook-mp.js`, que funciona mesmo se o cliente fechou o site).

**Cliente (`acompanhar.html`):** o link vai na confirmação e na mensagem do WhatsApp (`acompanhar.html?pedido=FFN-...&chave=...`). Sem o link, o cliente digita o número do pedido e o CPF (máximo de 8 tentativas a cada 15 minutos por pedido). Ele vê a linha do tempo, que muda conforme a entrega:

| Entrega | Etapas |
|---|---|
| Correios | Pagamento aprovado → Separando → Enviado → Saiu para entrega → Entregue |
| Cametá | Pagamento aprovado → Separando → Saiu para entrega → Entregue |
| Retirada | Pagamento aprovado → Separando → Pronto para retirar → Retirado |

Com código de rastreio, aparecem os eventos da **API de Rastreio dos Correios** (mesmo contrato do frete; consultados no máximo a cada 15 minutos). "Saiu para entrega" e "Entregue" avançam o pedido sozinhos. O cliente nunca vê CPF, e-mail, telefone nem endereço completo.

**Loja (`painel.html`, com `PAINEL_SENHA`):** abas *A fazer*, *A caminho*, *Concluídos*, *Aguardando pagamento*; busca por nome, pedido ou cidade; botão para a próxima etapa; campo do código de rastreio (salvar o código já marca *Enviado*); **Avisar no WhatsApp**, que abre a conversa com o cliente com a mensagem pronta para a etapa e o link de acompanhamento; dados completos do pedido e histórico. A lista se atualiza a cada minuto.

**Ativar:** na Vercel, *Storage → Create → KV (Upstash)* e conecte ao projeto (cria `KV_REST_API_URL` e `KV_REST_API_TOKEN`); defina `PAINEL_SENHA`; no Mercado Pago, cadastre o webhook `https://SEU-SITE/api/webhook-mp` (evento *Pagamentos*) e copie a assinatura secreta para `MP_WEBHOOK_SECRET`. Sem banco ou na prévia estática, acompanhamento e painel ficam em **modo demonstração** (pedidos de exemplo e os feitos no próprio aparelho).

## Cupons e campanhas

- **Cupons:** painel → *Cupons*. Desconto em % (até 90%) ou em R$, validade, limite de usos e compra mínima. O servidor confere e recalcula o desconto na cobrança; o uso só conta quando o pagamento é aprovado. Para divulgar, use o link `https://SEU-SITE/?cupom=CODIGO`: o desconto já vem aplicado no checkout.
- **Campanha:** em `js/loja.js` → `campanha`: `tema` (`"rosa"` para Outubro Rosa, `"nazare"` para o Círio, `"natal"`), `aviso` (faixa do topo), `ate` (contagem regressiva na abertura) e `cupom` (sugerido no checkout). Volte para `tema: "padrao"` e `aviso: ""` ao terminar.

## Aviso de pedido novo (Telegram)

Quando um pagamento é aprovado, a loja recebe no Telegram: peças, total, forma de pagamento, entrega, cliente e link do painel.

1. No Telegram, fale com **@BotFather** → `/newbot` → copie o token para `TELEGRAM_BOT_TOKEN`.
2. Mande qualquer mensagem para o bot novo e abra `https://api.telegram.org/bot<TOKEN>/getUpdates`: o número em `chat.id` vai em `TELEGRAM_CHAT_ID`.

## Segurança

- Cabeçalhos de segurança (CSP, bloqueio de iframe, nosniff, Referrer e Permissions-Policy) no `vercel.json` e no servidor local.
- Limite de tentativas por endereço: senha do painel (10 a cada 15 min), pagamento (15 a cada 10 min), consulta de pedido por CPF (30 a cada 15 min + 8 por pedido) e cupons (20 a cada 10 min). O IP é guardado só como resumo (hash).
- Preço, frete e desconto sempre recalculados no servidor; cartão nunca passa pelo servidor (token do Mercado Pago).
- `data/` (pedidos no modo local) nunca é servido nem publicado (`.gitignore` e `.vercelignore`).

## Páginas de produto e compartilhamento

Cada peça tem um link próprio (`?produto=short-sarja-madrid`): abre a peça direto, ideal para Stories, Destaques e WhatsApp. O botão **Compartilhar** usa o menu do celular (ou copia o link). O guia de medidas por categoria fica em `MEDIDAS`, no `js/produtos.js` (valores de referência: confirme com as peças da loja).

## Cadastrar ou alterar produtos

Edite `js/produtos.js`. Cada produto é um bloco com `nome`, `categoria`, `preco`, `cores`, `tamanhos` etc. (os campos estão explicados no topo do arquivo).

**Fotos:** cada peça tem a lista `fotos`, com quantas fotos quiser; a primeira é a capa da vitrine. Coloque os arquivos em `assets/img/` (de preferência `.webp`, em pé, proporção 4:5, uns 900×1100 px) e liste os caminhos:

```js
fotos: [
  "assets/img/short-linho-1.webp",
  { src: "assets/img/short-linho-areia.webp", cor: "Areia" }, // ao escolher a cor Areia, a galeria vai para esta foto
  "assets/img/short-linho-detalhe.webp",
],
```

Na peça aberta, as fotos viram uma galeria (deslizar no celular, setas e miniaturas no computador, toque para tela cheia com zoom). Na vitrine, o card mostra quantas fotos a peça tem e, no computador, troca para a segunda foto ao passar o mouse. Sem fotos (`fotos: []`), aparece o card com o panda e "Fotos em breve".

> Os preços atuais são provisórios e precisam ser confirmados com a loja.

## Trocar o número do WhatsApp

Em `js/app.js` (constante `WHATSAPP`) e nos links `wa.me` do `index.html`.

## Publicar

Use a **Vercel** (grátis), porque ela roda as funções de `api/` (frete e pagamento) sem configuração:

1. Em vercel.com, *Add New → Project* e importe este repositório.
2. Em *Settings → Environment Variables*, cadastre as variáveis acima (Correios, `MP_PUBLIC_KEY` e `MP_ACCESS_TOKEN`).
3. Faça o deploy. O site e as funções de `api/` sobem juntos.

GitHub Pages e outras hospedagens estáticas também mostram o site, mas sem frete dos Correios e com o pagamento em modo demonstração (o pedido pode ser finalizado pelo WhatsApp; Cametá continua com frete grátis).
