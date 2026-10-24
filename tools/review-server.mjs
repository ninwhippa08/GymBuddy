// Desk review: generate sessions on the laptop, write down what he thinks of
// each one, and keep both in a file Claude can read afterwards.
//
//   node tools/review-server.mjs          then open http://127.0.0.1:8765/tools/review.html
//
// Serves the repo as static files (the page imports the real js/generator.js
// and js/ui.js, so what he reviews is exactly what the phone would build) and
// takes two writes:
//
//   POST /api/config   the simulated athlete: return date and start date
//   POST /api/review   one reviewed session: the session object + his feedback
//
// Everything lands in .reviews/ at the repo root, which is gitignored. The
// repo is PUBLIC and his comments are his, so they never go near a commit.
// One review per line in reviews.jsonl -- appending a line cannot corrupt the
// ones already written, which a rewritten JSON array could.
//
// Zero dependencies, like the app: node:http, node:fs, node:path and nothing
// else. Bound to 127.0.0.1 only, so nothing else on the network can reach it.

import { createServer } from 'node:http';
import { readFileSync, appendFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, normalize, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(fileURLToPath(new URL('..', import.meta.url)));
const DIR = join(ROOT, '.reviews');
const LOG = join(DIR, 'reviews.jsonl');
const CONFIG = join(DIR, 'config.json');
const PORT = Number(process.env.PORT) || 8765;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

export function readReviews(file = LOG) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

function readConfig() {
  return existsSync(CONFIG) ? JSON.parse(readFileSync(CONFIG, 'utf8')) : null;
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  // no-store on everything: a cached generator.js is the same trap the
  // service worker set twice (a correct edit looking broken). The review page
  // registers no worker, and this keeps the browser's own cache out too.
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 5e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');

  if (url.pathname === '/api/state' && req.method === 'GET') {
    return send(res, 200, { config: readConfig(), reviews: readReviews() });
  }
  if (url.pathname === '/api/config' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.returnDate || !body.startDate) return send(res, 400, { error: 'returnDate and startDate required' });
    mkdirSync(DIR, { recursive: true });
    writeFileSync(CONFIG, JSON.stringify({ returnDate: body.returnDate, startDate: body.startDate }, null, 2));
    return send(res, 200, { ok: true });
  }
  if (url.pathname === '/api/review' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.session || !body.feedback) return send(res, 400, { error: 'session and feedback required' });
    mkdirSync(DIR, { recursive: true });
    appendFileSync(LOG, JSON.stringify({ savedAt: new Date().toISOString(), ...body }) + '\n');
    return send(res, 200, { ok: true, count: readReviews().length });
  }

  if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });

  // Static files. The resolved path must stay inside the repo, and .reviews
  // and .git are never served -- the page reads reviews through /api/state.
  const path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!path.startsWith(ROOT) || path.includes(`${sep}.git`) || path.includes(`${sep}.reviews`)) {
    return send(res, 403, 'forbidden', 'text/plain');
  }
  if (!existsSync(path) || !statSync(path).isFile()) return send(res, 404, 'not found', 'text/plain');
  return send(res, 200, readFileSync(path), TYPES[extname(path)] || 'application/octet-stream');
}

if (process.argv[1] && normalize(process.argv[1]) === normalize(fileURLToPath(import.meta.url))) {
  createServer((req, res) => {
    handle(req, res).catch(err => send(res, 500, { error: err.message }));
  }).listen(PORT, '127.0.0.1', () => {
    console.log(`Desk review: http://127.0.0.1:${PORT}/tools/review.html`);
    console.log(`Reviews are written to ${LOG}`);
  });
}
