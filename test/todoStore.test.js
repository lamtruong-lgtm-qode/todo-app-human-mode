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
