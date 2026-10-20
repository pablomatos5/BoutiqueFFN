# Boutique FFN · Fica Feio Nunca

Site de vendas da Boutique FFN (Cametá-PA): vitrine com filtros e busca, sacola, frete (grátis em Cametá, Correios para o resto do Brasil) e pedido finalizado pelo WhatsApp da loja.

O estudo de identidade visual que guiou o layout está em [`docs/identidade-visual.md`](docs/identidade-visual.md).

## Estrutura

```
index.html          página única: hero, categorias, loja, Lupo, como comprar, endereço
css/styles.css      estilos (cores e fontes no topo, em :root)
js/produtos.js      catálogo: edite aqui produtos, preços, cores e tamanhos
js/app.js           vitrine, sacola (salva no navegador), CEP/frete e envio do pedido ao WhatsApp
api/frete.js        função de servidor que consulta PAC e SEDEX na API dos Correios
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

## Cadastrar ou alterar produtos

Edite `js/produtos.js`. Cada produto é um bloco com `nome`, `categoria`, `preco`, `cores`, `tamanhos` etc. (os campos estão explicados no topo do arquivo). Coloque a foto em `assets/img/` e informe o caminho em `imagem`. Sem foto, o site mostra um card escuro com o panda.

> Os preços atuais são provisórios e precisam ser confirmados com a loja.

## Trocar o número do WhatsApp

Em `js/app.js` (constante `WHATSAPP`) e nos links `wa.me` do `index.html`.

## Publicar

Use a **Vercel** (grátis), porque ela roda a função `api/frete.js` sem configuração:

1. Em vercel.com, *Add New → Project* e importe este repositório.
2. Em *Settings → Environment Variables*, cadastre as variáveis acima.
3. Faça o deploy. O site e o `/api/frete` sobem juntos.

GitHub Pages e outras hospedagens estáticas também mostram o site, mas sem o cálculo dos Correios: lá o frete fica *a combinar* (Cametá continua grátis).
