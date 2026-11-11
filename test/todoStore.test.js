const test = require('node:test');
const assert = require('node:assert');
const { TodoStore } = require('../src/todoStore');

test('create adds a todo with trimmed title', () => {
  const store = new TodoStore();
  const todo = store.create('  Buy milk  ');
  assert.strictEqual(todo.title, 'Buy milk');
  assert.strictEqual(todo.completed, false);
  assert.strictEqual(store.list().length, 1);
});

test('create rejects empty title', () => {
  const store = new TodoStore();
  assert.throws(() => store.create('   '), /Title is required/);
});

test('update toggles completed', () => {
  const store = new TodoStore();
  const { id } = store.create('Task');
  assert.strictEqual(store.update(id, { completed: true }).completed, true);
});

test('update returns null for missing todo', () => {
  const store = new TodoStore();
  assert.strictEqual(store.update(999, { completed: true }), null);
});

test('list filters by status', () => {
  const store = new TodoStore();
  store.create('A');
  const b = store.create('B');
  store.update(b.id, { completed: true });
  assert.strictEqual(store.list('active').length, 1);
  assert.strictEqual(store.list('completed').length, 1);
  assert.strictEqual(store.list('all').length, 2);
});

test('remove deletes a todo', () => {
  const store = new TodoStore();
  const { id } = store.create('Task');
  assert.strictEqual(store.remove(id), true);
  assert.strictEqual(store.remove(id), false);
});

test('clearCompleted removes only completed todos', () => {
  const store = new TodoStore();
  store.create('A');
  const b = store.create('B');
  store.update(b.id, { completed: true });
  assert.strictEqual(store.clearCompleted(), 1);
  assert.strictEqual(store.list().length, 1);
});

test('update rejects non-boolean completed', () => {
  const store = new TodoStore();
  const { id } = store.create('Task');
  assert.throws(() => store.update(id, { completed: 'yes' }), /boolean/);
});

test('list rejects unknown filter', () => {
  const store = new TodoStore();
  assert.throws(() => store.list('bogus'), /Filter/);
});

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-store-'));
  return { dir, file: path.join(dir, 'todos.json') };
}

test('file persistence reloads todos and never reuses ids', () => {
  const { dir, file } = tempFile();
  try {
    const a = new TodoStore({ file });
    const first = a.create('One');
    const second = a.create('Two');
    a.update(first.id, { completed: true });
    a.remove(second.id);

    const b = new TodoStore({ file });
    assert.strictEqual(b.list().length, 1);
    assert.strictEqual(b.get(first.id).completed, true);
    assert.strictEqual(b.create('Three').id, second.id + 1);
    assert.deepStrictEqual(fs.readdirSync(dir), ['todos.json']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('missing or corrupt file starts empty', () => {
  const { dir, file } = tempFile();
  try {
    assert.strictEqual(new TodoStore({ file }).list().length, 0);
    fs.writeFileSync(file, '{not json');
    const store = new TodoStore({ file });
    assert.strictEqual(store.list().length, 0);
    assert.strictEqual(store.create('Fresh').id, 1);
    assert.strictEqual(new TodoStore({ file }).list().length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('title boundary: 200 accepted, 201 rejected on create and update', () => {
  const store = new TodoStore();
  assert.strictEqual(store.create('x'.repeat(200)).title.length, 200);
  assert.throws(() => store.create('x'.repeat(201)), /at most 200/);
  assert.strictEqual(store.create(`  ${'y'.repeat(200)}  `).title.length, 200);
  const { id } = store.create('Task');
  assert.throws(() => store.update(id, { title: 'x'.repeat(201) }), /at most 200/);
  assert.throws(() => store.update(id, { title: '   ' }), /Title is required/);
  assert.strictEqual(store.update(id, { title: 'x'.repeat(200) }).title.length, 200);
  assert.strictEqual(store.get(id).title.length, 200);
});
