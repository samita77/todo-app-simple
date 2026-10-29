'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  validateTitle,
  parseTodoId,
  validatePatch,
} = require('../utils/validators');
const { createTodoStore } = require('./store');

const MAX_BODY_BYTES = 16 * 1024;
const INDEX_HTML = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'index.html'),
  'utf8',
);

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function sendText(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim() === '') {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('body must be valid JSON'), { status: 400 }));
      }
    });

    req.on('error', reject);
  });
}

/**
 * Build the request handler plus the metrics object that /metrics exposes.
 * Kept free of `listen()` so tests can drive it directly.
 */
function createApp({ store = createTodoStore() } = {}) {
  const metrics = {
    startedAt: Date.now(),
    requests: 0,
    errors: 0,
    created: 0,
    updated: 0,
    deleted: 0,
  };

  async function handler(req, res) {
    metrics.requests += 1;
    const started = process.hrtime.bigint();
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    res.on('finish', () => {
      if (res.statusCode >= 500) metrics.errors += 1;
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
      if (elapsedMs > 100) {
        console.warn(
          `slow request ${req.method} ${pathname} -> ${res.statusCode} in ${elapsedMs.toFixed(1)}ms`,
        );
      }
    });

    try {
      if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
        sendText(res, 200, INDEX_HTML, 'text/html; charset=utf-8');
        return;
      }

      if (req.method === 'GET' && pathname === '/health') {
        sendJson(res, 200, {
          status: 'ok',
          service: 'todo-app',
          uptimeSeconds: Number(((Date.now() - metrics.startedAt) / 1000).toFixed(2)),
          todos: store.size,
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/metrics') {
        const uptime = (Date.now() - metrics.startedAt) / 1000;
        const body = [
          '# HELP todo_app_http_requests_total Total HTTP requests handled.',
          '# TYPE todo_app_http_requests_total counter',
          `todo_app_http_requests_total ${metrics.requests}`,
          '# HELP todo_app_http_errors_total HTTP responses with a 5xx status.',
          '# TYPE todo_app_http_errors_total counter',
          `todo_app_http_errors_total ${metrics.errors}`,
          '# HELP todo_app_todos Number of stored todos.',
          '# TYPE todo_app_todos gauge',
          `todo_app_todos ${store.size}`,
          '# HELP todo_app_todos_created_total Todos created since start.',
          '# TYPE todo_app_todos_created_total counter',
          `todo_app_todos_created_total ${metrics.created}`,
          '# HELP todo_app_todos_updated_total Todos updated since start.',
          '# TYPE todo_app_todos_updated_total counter',
          `todo_app_todos_updated_total ${metrics.updated}`,
          '# HELP todo_app_todos_deleted_total Todos deleted since start.',
          '# TYPE todo_app_todos_deleted_total counter',
          `todo_app_todos_deleted_total ${metrics.deleted}`,
          '# HELP todo_app_uptime_seconds Process uptime in seconds.',
          '# TYPE todo_app_uptime_seconds gauge',
          `todo_app_uptime_seconds ${uptime.toFixed(3)}`,
          '',
        ].join('\n');
        sendText(res, 200, body, 'text/plain; version=0.0.4; charset=utf-8');
        return;
      }

      if (pathname === '/api/todos' || pathname.startsWith('/api/todos/')) {
        await handleTodos(req, res, pathname);
        return;
      }

      sendJson(res, 404, { error: 'not found' });
    } catch (error) {
      const status = error.status || 500;
      if (status >= 500) {
        metrics.errors += 1;
        console.error('unhandled error', error);
      }
      sendJson(res, status, { error: error.message || 'internal server error' });
    }
  }

  async function handleTodos(req, res, pathname) {
    const rest = pathname.slice('/api/todos'.length).replace(/^\/+/, '');
    const parts = rest === '' ? [] : rest.split('/');

    if (parts.length === 0) {
      if (req.method === 'GET') {
        sendJson(res, 200, { todos: store.list() });
        return;
      }

      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        const result = validateTitle(body.title);
        if (!result.ok) {
          sendJson(res, 400, { error: result.error });
          return;
        }
        const todo = store.create(result.value);
        metrics.created += 1;
        sendJson(res, 201, todo);
        return;
      }

      res.setHeader('Allow', 'GET, POST');
      sendJson(res, 405, { error: 'method not allowed' });
      return;
    }

    if (parts.length !== 1) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }

    const id = parseTodoId(parts[0]);
    if (id === null) {
      sendJson(res, 400, { error: 'invalid todo id' });
      return;
    }

    if (req.method === 'GET') {
      const todo = store.get(id);
      if (!todo) {
        sendJson(res, 404, { error: 'todo not found' });
        return;
      }
      sendJson(res, 200, todo);
      return;
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      const body = await readJsonBody(req);
      const result = validatePatch(body);
      if (!result.ok) {
        sendJson(res, 400, { error: result.error });
        return;
      }
      const todo = store.update(id, result.value);
      if (!todo) {
        sendJson(res, 404, { error: 'todo not found' });
        return;
      }
      metrics.updated += 1;
      sendJson(res, 200, todo);
      return;
    }

    if (req.method === 'DELETE') {
      const removed = store.remove(id);
      if (!removed) {
        sendJson(res, 404, { error: 'todo not found' });
        return;
      }
      metrics.deleted += 1;
      sendJson(res, 200, { deleted: true, id });
      return;
    }

    res.setHeader('Allow', 'GET, PATCH, PUT, DELETE');
    sendJson(res, 405, { error: 'method not allowed' });
  }

  return { handler, metrics, store };
}

module.exports = { createApp };
