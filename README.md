# Boutique FFN · Fica Feio Nunca

Site de vendas da Boutique FFN (Cametá-PA): vitrine com filtros e busca, sacola, frete (grátis em Cametá, Correios para o resto do Brasil), pagamento com Pix e cartão dentro do próprio site (Checkout Transparente do Mercado Pago) e aviso do pedido no WhatsApp da loja.

O estudo de identidade visual que guiou o layout está em [`docs/identidade-visual.md`](docs/identidade-visual.md).

## Estrutura

```
index.html          loja: abertura, categorias, vitrine, Lupo, como comprar, endereço
finalizar.html      página de finalizar pedido: sacola, dados, entrega/frete e pagamento
css/styles.css      estilos (cores e fontes no topo, em :root)
js/produtos.js      catálogo: edite aqui produtos, preços, cores e tamanhos
js/comum.js         funções usadas pelas duas páginas (sacola salva no navegador, preços, itens)
js/app.js           loja: vitrine, filtros, detalhe do produto e gaveta da sacola
js/finalizar.js     finalizar: CEP/frete, validação, confirmação e WhatsApp
js/pagamento.js     aba de pagamento: Pix (QR e copia e cola) e cartão (campos seguros do Mercado Pago)
js/efeitos.js       animações e interações (desligadas se o aparelho pede "reduzir movimento")
api/frete.js        função de servidor que consulta PAC e SEDEX na API dos Correios
api/pagamento.js    função de servidor que cria o pagamento (Pix ou cartão) e consulta a situação do Pix
api/config.js       entrega ao navegador a Public Key do Mercado Pago
server.js           servidor local (site + funções de api/)
assets/img/         fotos e o panda
```

Não há build nem dependências: HTML, CSS e JavaScript puro, mais uma função Node (18+) para o frete.

## Rodar localmente

```bash
cp .env.example .env   # preencha as credenciais dos Correios (opcional para testar)
npm run dev
# http://localhost:8000
```

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

## Cadastrar ou alterar produtos

Edite `js/produtos.js`. Cada produto é um bloco com `nome`, `categoria`, `preco`, `cores`, `tamanhos` etc. (os campos estão explicados no topo do arquivo). Coloque a foto em `assets/img/` e informe o caminho em `imagem`. Sem foto, o site mostra um card escuro com o panda.

> Os preços atuais são provisórios e precisam ser confirmados com a loja.

## Trocar o número do WhatsApp

Em `js/app.js` (constante `WHATSAPP`) e nos links `wa.me` do `index.html`.

## Publicar

Use a **Vercel** (grátis), porque ela roda as funções de `api/` (frete e pagamento) sem configuração:

1. Em vercel.com, *Add New → Project* e importe este repositório.
2. Em *Settings → Environment Variables*, cadastre as variáveis acima (Correios, `MP_PUBLIC_KEY` e `MP_ACCESS_TOKEN`).
3. Faça o deploy. O site e as funções de `api/` sobem juntos.

GitHub Pages e outras hospedagens estáticas também mostram o site, mas sem frete dos Correios e com o pagamento em modo demonstração (o pedido pode ser finalizado pelo WhatsApp; Cametá continua com frete grátis).
