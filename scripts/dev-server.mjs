import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = resolve(fileURLToPath(new URL('..', import.meta.url)));
const EXPLICIT = new Set(['/', '/index.html', '/styles.css']);
const SOURCE_FILE = /^\/src\/(?:(?:core|storage|ui|integrations)(?:\/[a-z0-9_-]+)?)\/[a-z0-9_-]+\.js$/;
const CONTENT_TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const POLICY = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'";

export function createServer({ root = BASE } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader('Content-Security-Policy', POLICY);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
      return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end('Invalid path'); return; }
    if (!EXPLICIT.has(pathname) && !SOURCE_FILE.test(pathname)) {
      res.writeHead(404).end('Not found');
      return;
    }
    const target = resolve(root, pathname === '/' ? 'index.html' : pathname.slice(1));
    const type = target.endsWith('.html') ? CONTENT_TYPES['.html'] : target.endsWith('.css') ? CONTENT_TYPES['.css'] : CONTENT_TYPES['.js'];
    try {
      const body = await readFile(target);
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || '4173');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  createServer().listen(port, '127.0.0.1', () => {
    console.log(`DEX//Pad synthetic-data development sandbox: http://127.0.0.1:${port}`);
    console.log('UNENCRYPTED DEVELOPMENT STORAGE - DO NOT ENTER PRIVATE DATA.');
  });
}
