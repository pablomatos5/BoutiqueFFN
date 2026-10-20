/* Servidor local: serve o site e a função /api/frete. Uso: npm run dev */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import frete from "./api/frete.js";
import pagamento from "./api/pagamento.js";

const raiz = path.dirname(new URL(import.meta.url).pathname);
const porta = Number(process.env.PORT) || 8000;

// Carrega .env (formato CHAVE=valor) sem dependências
if (fs.existsSync(path.join(raiz, ".env"))) {
  for (const linha of fs.readFileSync(path.join(raiz, ".env"), "utf8").split("\n")) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const tipos = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".json": "application/json" };

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/frete") return frete(req, res);
    if (url.pathname === "/api/pagamento") return pagamento(req, res);

    const arquivo = path.normalize(path.join(raiz, url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname)));
    if (!arquivo.startsWith(raiz) || /[\\/](\.env|api|node_modules)/.test(arquivo.slice(raiz.length)) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      res.statusCode = 404;
      return res.end("Não encontrado");
    }
    res.setHeader("Content-Type", (tipos[path.extname(arquivo)] || "application/octet-stream") + "; charset=utf-8");
    fs.createReadStream(arquivo).pipe(res);
  })
  .listen(porta, () => console.log(`Boutique FFN em http://localhost:${porta}`));
