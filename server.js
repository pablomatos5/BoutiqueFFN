/* Servidor local: serve o site e a função /api/frete. Uso: npm run dev */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const raiz = path.dirname(new URL(import.meta.url).pathname);
const porta = Number(process.env.PORT) || 8000;

// Carrega .env (formato CHAVE=valor) sem dependências
if (fs.existsSync(path.join(raiz, ".env"))) {
  for (const linha of fs.readFileSync(path.join(raiz, ".env"), "utf8").split("\n")) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// mesmos cabeçalhos de segurança da Vercel, para testar localmente
const seguranca = JSON.parse(fs.readFileSync(path.join(raiz, "seguranca.json"), "utf8")).headers;

const tipos = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".json": "application/json" };

http
  .createServer((req, res) => {
    for (const [k, v] of Object.entries(seguranca)) res.setHeader(k, k === "Content-Security-Policy" ? v.replace("; upgrade-insecure-requests", "") : v);
    const url = new URL(req.url, "http://localhost");
    const rota = url.pathname.match(/^\/api\/([a-z-]+)$/);
    if (rota) {
      const arquivo = path.join(raiz, "api", `${rota[1]}.js`);
      if (!fs.existsSync(arquivo)) { res.statusCode = 404; return res.end("Não encontrado"); }
      return import(arquivo).then((m) => m.default(req, res));
    }

    const arquivo = path.normalize(path.join(raiz, url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname)));
    if (!arquivo.startsWith(raiz) || /[\\/](\.env|api|node_modules|data|seguranca\.json)/.test(arquivo.slice(raiz.length)) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      // mesma página 404 da Vercel e do GitHub Pages
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return fs.createReadStream(path.join(raiz, "404.html")).pipe(res);
    }
    res.setHeader("Content-Type", (tipos[path.extname(arquivo)] || "application/octet-stream") + "; charset=utf-8");
    fs.createReadStream(arquivo).pipe(res);
  })
  .listen(porta, () => console.log(`Boutique FFN em http://localhost:${porta}`));
