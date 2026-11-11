const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/server');

async function withServer(fn) {
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://localhost:${server.address().port}`;
  const call = (method, path, body) =>
    fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    await fn(call);
  } finally {
    server.close();
  }
}

test('v1 starts empty and is not seeded by createApp', async () => {
  await withServer(async (call) => {
    const res = await call('GET', '/v1/todos');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), []);
  });
});

test('v1 create trims the title and returns string id and done flag', async () => {
  await withServer(async (call) => {
    const res = await call('POST', '/v1/todos', { title: '  Buy milk  ' });
    assert.strictEqual(res.status, 201);
    const todo = await res.json();
    assert.strictEqual(typeof todo.id, 'string');
    assert.strictEqual(todo.title, 'Buy milk');
    assert.strictEqual(todo.done, false);
    assert.ok(!Number.isNaN(Date.parse(todo.createdAt)));
  });
});

test('v1 create rejects empty, blank, missing, non-string and over-long titles', async () => {
  await withServer(async (call) => {
    for (const body of [{ title: '' }, { title: '   ' }, {}, { title: 5 }, { title: 'x'.repeat(201) }]) {
      const res = await call('POST', '/v1/todos', body);
      assert.strictEqual(res.status, 400);
      assert.ok((await res.json()).error);
    }
    const ok = await call('POST', '/v1/todos', { title: 'x'.repeat(200) });
    assert.strictEqual(ok.status, 201);
  });
});

test('v1 toggle flips done and filter splits the list', async () => {
  await withServer(async (call) => {
    const a = await (await call('POST', '/v1/todos', { title: 'A' })).json();
    await call('POST', '/v1/todos', { title: 'B' });

    let res = await call('POST', `/v1/todos/${a.id}/toggle`);
    assert.strictEqual(res.status, 200);
    const toggled = await res.json();
    assert.strictEqual(toggled.done, true);
    assert.strictEqual(toggled.createdAt, a.createdAt);

    const listed = await (await call('GET', '/v1/todos')).json();
    for (const t of listed) {
      assert.deepStrictEqual(Object.keys(t).sort(), ['createdAt', 'done', 'id', 'title']);
      assert.strictEqual(typeof t.id, 'string');
      assert.ok(!Number.isNaN(Date.parse(t.createdAt)));
    }

    const titles = async (q) => (await (await call('GET', `/v1/todos${q}`)).json()).map((t) => t.title);
    assert.deepStrictEqual(await titles(''), ['A', 'B']);
    assert.deepStrictEqual(await titles('?filter=active'), ['B']);
    assert.deepStrictEqual(await titles('?filter=completed'), ['A']);
    assert.strictEqual((await call('GET', '/v1/todos?filter=done')).status, 400);

    res = await call('POST', `/v1/todos/${a.id}/toggle`);
    assert.strictEqual((await res.json()).done, false);

    res = await call('GET', '/v1/todos?filter=bogus');
    assert.strictEqual(res.status, 400);
  });
});

test('v1 patch updates the title and validates it', async () => {
  await withServer(async (call) => {
    const a = await (await call('POST', '/v1/todos', { title: 'A' })).json();
    let res = await call('PATCH', `/v1/todos/${a.id}`, { title: ' Renamed ' });
    assert.strictEqual(res.status, 200);
    const patched = await res.json();
    assert.strictEqual(patched.title, 'Renamed');
    assert.strictEqual(patched.createdAt, a.createdAt);
    assert.strictEqual(typeof patched.id, 'string');

    res = await call('PATCH', `/v1/todos/${a.id}`, { title: '  ' });
    assert.strictEqual(res.status, 400);
    res = await call('PATCH', `/v1/todos/${a.id}`, { title: 'x'.repeat(201) });
    assert.strictEqual(res.status, 400);
  });
});

test('v1 delete returns 204 then 404', async () => {
  await withServer(async (call) => {
    const a = await (await call('POST', '/v1/todos', { title: 'A' })).json();
    let res = await call('DELETE', `/v1/todos/${a.id}`);
    assert.strictEqual(res.status, 204);
    res = await call('DELETE', `/v1/todos/${a.id}`);
    assert.strictEqual(res.status, 404);
    assert.deepStrictEqual(await (await call('GET', '/v1/todos')).json(), []);
  });
});

test('v1 returns 404 for unknown ids on toggle and patch', async () => {
  await withServer(async (call) => {
    let res = await call('POST', '/v1/todos/999/toggle');
    assert.strictEqual(res.status, 404);
    assert.ok((await res.json()).error);
    res = await call('PATCH', '/v1/todos/999', { title: 'x' });
    assert.strictEqual(res.status, 404);
  });
});

test('/api/todos stays in sync with /v1', async () => {
  await withServer(async (call) => {
    await call('POST', '/v1/todos', { title: 'Shared' });
    const list = await (await call('GET', '/api/todos')).json();
    assert.strictEqual(list[0].title, 'Shared');
    assert.strictEqual(typeof list[0].id, 'number');
  });
});

test('v1 DELETE /v1/todos clears only done todos and returns the count', async () => {
  await withServer(async (call) => {
    const a = await (await call('POST', '/v1/todos', { title: 'A' })).json();
    const b = await (await call('POST', '/v1/todos', { title: 'B' })).json();
    await call('POST', '/v1/todos', { title: 'C' });
    await call('POST', `/v1/todos/${a.id}/toggle`);
    await call('POST', `/v1/todos/${b.id}/toggle`);

    let res = await call('DELETE', '/v1/todos');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { removed: 2 });

    const list = await (await call('GET', '/v1/todos')).json();
    assert.deepStrictEqual(list.map((t) => t.title), ['C']);

    res = await call('DELETE', '/v1/todos');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { removed: 0 });
  });
});
