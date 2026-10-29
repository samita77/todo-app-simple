'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createApp } = require('../src/app');

async function withServer(run) {
  const { handler, store } = createApp();
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    await run({ base, store });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(base, path, options = {}) {
  const response = await fetch(base + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

test('GET /health reports ok', async () => {
  await withServer(async ({ base }) => {
    const { response, body } = await request(base, '/health');
    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'todo-app');
  });
});

test('todo lifecycle: create, list, toggle, delete', async () => {
  await withServer(async ({ base }) => {
    const created = await request(base, '/api/todos', {
      method: 'POST',
      body: JSON.stringify({ title: '  first   todo ' }),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.title, 'first todo');
    assert.equal(created.body.completed, false);

    const id = created.body.id;

    const listed = await request(base, '/api/todos');
    assert.equal(listed.response.status, 200);
    assert.equal(listed.body.todos.length, 1);

    const toggled = await request(base, `/api/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: true }),
    });
    assert.equal(toggled.response.status, 200);
    assert.equal(toggled.body.completed, true);

    const fetched = await request(base, `/api/todos/${id}`);
    assert.equal(fetched.body.completed, true);

    const deleted = await request(base, `/api/todos/${id}`, { method: 'DELETE' });
    assert.equal(deleted.response.status, 200);

    const missing = await request(base, `/api/todos/${id}`);
    assert.equal(missing.response.status, 404);
  });
});

test('POST /api/todos rejects an empty title', async () => {
  await withServer(async ({ base }) => {
    const { response, body } = await request(base, '/api/todos', {
      method: 'POST',
      body: JSON.stringify({ title: '   ' }),
    });
    assert.equal(response.status, 400);
    assert.match(body.error, /must not be empty/);
  });
});

test('unknown routes return 404 and bad ids return 400', async () => {
  await withServer(async ({ base }) => {
    const unknown = await request(base, '/nope');
    assert.equal(unknown.response.status, 404);

    const badId = await request(base, '/api/todos/abc');
    assert.equal(badId.response.status, 400);
  });
});

test('GET / serves the HTML dashboard', async () => {
  await withServer(async ({ base }) => {
    const response = await fetch(base + '/');
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(html, /<title>Todo/);
  });
});

test('GET /metrics exposes Prometheus-style counters', async () => {
  await withServer(async ({ base }) => {
    await request(base, '/health');
    const { response, body } = await request(base, '/metrics');
    assert.equal(response.status, 200);
    assert.match(body, /todo_app_http_requests_total \d+/);
    assert.match(body, /todo_app_todos \d+/);
    assert.match(body, /todo_app_uptime_seconds/);
  });
});
