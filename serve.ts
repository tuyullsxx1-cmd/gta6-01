// serve.ts — tiny static file server for local play (Node 22, stdlib only).
//
// Serves this repository's root so the game plays at
// http://localhost:8080/game/index.html — no build step, no network.
// Run with: node serve.ts

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT: string = resolve(dirname(fileURLToPath(import.meta.url)));
const PORT: number = Number(process.env.PORT || 8080);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/') {
      res.writeHead(302, { Location: '/game/index.html' });
      res.end();
      return;
    }
    const decoded = decodeURIComponent(url.pathname);
    const file = resolve(join(ROOT, decoded));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden\n');
      return;
    }
    let target = file;
    const info = await stat(target).catch(() => null);
    if (!info) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found\n');
      return;
    }
    if (info.isDirectory()) {
      target = join(target, 'index.html');
      const indexInfo = await stat(target).catch(() => null);
      if (!indexInfo || !indexInfo.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found\n');
        return;
      }
    }
    const body = await readFile(target);
    const type = MIME[extname(target).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error\n');
  }
});

server.listen(PORT, () => {
  console.log(`MARAVILLA at http://localhost:${PORT}/game/index.html`);
});
