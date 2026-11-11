const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/server');

async function withServer(fn) {
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://localhost:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

test('REST API CRUD flow', async () => {
  await withServer(async (base) => {
    let res = await fetch(`${base}/api/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Write tests' }),
    });
    assert.strictEqual(res.status, 201);
    const todo = await res.json();

    res = await fetch(`${base}/api/todos/${todo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    });
    assert.strictEqual((await res.json()).completed, true);

    res = await fetch(`${base}/api/todos`);
    assert.strictEqual((await res.json()).length, 1);

    res = await fetch(`${base}/api/todos/${todo.id}`, { method: 'DELETE' });
    assert.strictEqual(res.status, 204);

    res = await fetch(`${base}/api/todos/${todo.id}`);
    assert.strictEqual(res.status, 404);
  });
});

test('POST with empty title returns 400', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    });
    assert.strictEqual(res.status, 400);
  });
});

async function api(base, method, path, body, raw) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

test('PATCH rejects non-boolean completed with 400', async () => {
  await withServer(async (base) => {
    const { body: todo } = await api(base, 'POST', '/api/todos', { title: 'A' });
    for (const bad of ['yes', 1, null, 'true']) {
      const r = await api(base, 'PATCH', `/api/todos/${todo.id}`, { completed: bad });
      assert.strictEqual(r.status, 400);
      assert.ok(r.body.error);
    }
    const ok = await api(base, 'PATCH', `/api/todos/${todo.id}`, { completed: true });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.body.completed, true);
  });
});

test('list filters and invalid filter', async () => {
  await withServer(async (base) => {
    const a = (await api(base, 'POST', '/api/todos', { title: 'A' })).body;
    await api(base, 'POST', '/api/todos', { title: 'B' });
    await api(base, 'PATCH', `/api/todos/${a.id}`, { completed: true });
    const all = await api(base, 'GET', '/api/todos?filter=all');
    const active = await api(base, 'GET', '/api/todos?filter=active');
    const done = await api(base, 'GET', '/api/todos?filter=completed');
    assert.strictEqual(all.body.length, 2);
    assert.deepStrictEqual(active.body.map((t) => t.title), ['B']);
    assert.deepStrictEqual(done.body.map((t) => t.title), ['A']);
    const bad = await api(base, 'GET', '/api/todos?filter=bogus');
    assert.strictEqual(bad.status, 400);
    assert.ok(bad.body.error);
  });
});

test('DELETE /api/todos returns removed count', async () => {
  await withServer(async (base) => {
    const a = (await api(base, 'POST', '/api/todos', { title: 'A' })).body;
    await api(base, 'POST', '/api/todos', { title: 'B' });
    await api(base, 'PATCH', `/api/todos/${a.id}`, { completed: true });
    const r = await api(base, 'DELETE', '/api/todos');
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.body, { removed: 1 });
  });
});

test('invalid JSON returns 400', async () => {
  await withServer(async (base) => {
    const r = await api(base, 'POST', '/api/todos', undefined, '{not json');
    assert.strictEqual(r.status, 400);
    assert.ok(r.body.error);
  });
});

test('PATCH unknown id returns 404', async () => {
  await withServer(async (base) => {
    const r = await api(base, 'PATCH', '/api/todos/999', { completed: true });
    assert.strictEqual(r.status, 404);
  });
});

test('body over 100 KB returns 413 and closes the connection', async () => {
  await withServer(async (base) => {
    const { port, hostname } = new URL(base);
    const payload = JSON.stringify({ title: 'x'.repeat(101 * 1024) });
    const http = require('node:http');
    const result = await new Promise((resolve, reject) => {
      const req = http.request(
        { port, hostname, method: 'POST', path: '/api/todos', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
        (res) => {
          res.resume();
          res.on('close', () => resolve({ status: res.statusCode, connection: res.headers.connection }));
        },
      );
      req.on('error', (err) => (err.code === 'ECONNRESET' || err.code === 'EPIPE' ? undefined : reject(err)));
      req.end(payload);
    });
    assert.strictEqual(result.status, 413);
    assert.strictEqual(result.connection, 'close');
  });
});

test('static serving blocks path traversal', async () => {
  await withServer(async (base) => {
    const { port, hostname } = new URL(base);
    const http = require('node:http');
    for (const p of ['/../package.json', '/../public-evil/x', '/%2e%2e/package.json']) {
      const status = await new Promise((resolve, reject) => {
        http.get({ port, hostname, path: p }, (res) => {
          res.resume();
          resolve(res.statusCode);
        }).on('error', reject);
      });
      assert.ok(status === 403 || status === 404, `${p} -> ${status}`);
    }
    const ok = await fetch(`${base}/`);
    assert.strictEqual(ok.status, 200);
  });
});

test('legacy API enforces the 200-character title cap on create and update', async () => {
  await withServer(async (base) => {
    const send = (method, path, title) =>
      fetch(`${base}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
    assert.strictEqual((await send('POST', '/api/todos', 'x'.repeat(201))).status, 400);
    const ok = await send('POST', '/api/todos', 'x'.repeat(200));
    assert.strictEqual(ok.status, 201);
    const { id } = await ok.json();
    assert.strictEqual((await send('PATCH', `/api/todos/${id}`, 'x'.repeat(201))).status, 400);
    assert.strictEqual((await send('PATCH', `/api/todos/${id}`, 'z'.repeat(200))).status, 200);
  });
});
