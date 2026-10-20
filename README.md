# Boutique FFN · Fica Feio Nunca

Site de vendas da Boutique FFN (Cametá-PA): vitrine com filtros e busca, sacola e pedido finalizado pelo WhatsApp da loja.

O estudo de identidade visual que guiou o layout está em [`docs/identidade-visual.md`](docs/identidade-visual.md).

## Estrutura

```
index.html          página única: hero, categorias, loja, Lupo, como comprar, endereço
css/styles.css      estilos (cores e fontes no topo, em :root)
js/produtos.js      catálogo: edite aqui produtos, preços, cores e tamanhos
js/app.js           vitrine, sacola (salva no navegador) e envio do pedido ao WhatsApp
assets/img/         fotos e o panda
```

Não há build nem dependências: é HTML, CSS e JavaScript puro.

## Rodar localmente

Abra `index.html` no navegador, ou sirva a pasta:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Cadastrar ou alterar produtos

Edite `js/produtos.js`. Cada produto é um bloco com `nome`, `categoria`, `preco`, `cores`, `tamanhos` etc. (os campos estão explicados no topo do arquivo). Coloque a foto em `assets/img/` e informe o caminho em `imagem`. Sem foto, o site mostra um card escuro com o panda.

> Os preços atuais são provisórios e precisam ser confirmados com a loja.

## Trocar o número do WhatsApp

Em `js/app.js` (constante `WHATSAPP`) e nos links `wa.me` do `index.html`.

## Publicar

Qualquer hospedagem estática serve: GitHub Pages (Settings → Pages → branch), Netlify ou Vercel (arrastar a pasta).
