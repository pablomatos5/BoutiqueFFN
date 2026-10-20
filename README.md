# Boutique FFN · Fica Feio Nunca

Site de vendas da Boutique FFN (Cametá-PA): vitrine com filtros e busca, sacola, frete (grátis em Cametá, Correios para o resto do Brasil), pagamento pelo Mercado Pago e aviso do pedido no WhatsApp da loja.

O estudo de identidade visual que guiou o layout está em [`docs/identidade-visual.md`](docs/identidade-visual.md).

## Estrutura

```
index.html          página única: hero, categorias, loja, Lupo, como comprar, endereço
css/styles.css      estilos (cores e fontes no topo, em :root)
js/produtos.js      catálogo: edite aqui produtos, preços, cores e tamanhos
js/app.js           vitrine, sacola (salva no navegador), CEP/frete e envio do pedido ao WhatsApp
api/frete.js        função de servidor que consulta PAC e SEDEX na API dos Correios
api/pagamento.js    função de servidor que cria o pagamento no Mercado Pago (Checkout Pro)
server.js           servidor local (site + /api/frete)
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

## Pagamento (Mercado Pago)

O botão **Pagar com Mercado Pago** chama `api/pagamento.js`, que monta o pedido a partir do catálogo (`js/produtos.js`), recalcula o frete e cria uma preferência do **Checkout Pro**. O cliente paga com Pix, cartão ou boleto no ambiente do Mercado Pago e volta ao site, que mostra o resultado (aprovado, pendente ou não concluído) e um botão para avisar a loja no WhatsApp com o número do pedido e o ID do pagamento.

- Preços e frete são sempre recalculados no servidor, então o valor não pode ser alterado pelo navegador.
- Os pagamentos aparecem no painel do Mercado Pago da loja, com o número do pedido (`FFN-...`) como referência externa e os dados de entrega.
- Se o pagamento online não estiver disponível (sem token, ou frete dos Correios fora do ar), o site mostra o aviso e o cliente ainda pode finalizar pelo WhatsApp.

**Credencial:** em [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers) → *Suas integrações* → criar aplicação (Checkout Pro) → *Credenciais de produção*, copie o **Access Token** para `MP_ACCESS_TOKEN`. Para testar sem cobrar, use o Access Token de **teste** e os cartões de teste do Mercado Pago.

## Cadastrar ou alterar produtos

Edite `js/produtos.js`. Cada produto é um bloco com `nome`, `categoria`, `preco`, `cores`, `tamanhos` etc. (os campos estão explicados no topo do arquivo). Coloque a foto em `assets/img/` e informe o caminho em `imagem`. Sem foto, o site mostra um card escuro com o panda.

> Os preços atuais são provisórios e precisam ser confirmados com a loja.

## Trocar o número do WhatsApp

Em `js/app.js` (constante `WHATSAPP`) e nos links `wa.me` do `index.html`.

## Publicar

Use a **Vercel** (grátis), porque ela roda as funções de `api/` (frete e pagamento) sem configuração:

1. Em vercel.com, *Add New → Project* e importe este repositório.
2. Em *Settings → Environment Variables*, cadastre as variáveis acima (Correios e `MP_ACCESS_TOKEN`).
3. Faça o deploy. O site e as funções `/api/frete` e `/api/pagamento` sobem juntos.

GitHub Pages e outras hospedagens estáticas também mostram o site, mas sem frete dos Correios nem pagamento online: lá o pedido é finalizado pelo WhatsApp (Cametá continua com frete grátis).
