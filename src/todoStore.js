'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FILTERS = ['all', 'active', 'completed'];

class TodoStore {
  constructor({ file } = {}) {
    this.file = file || null;
    this.todos = [];
    this.nextId = 1;
    if (this.file) this.load();
  }

  load() {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      return;
    }
    if (!data || !Array.isArray(data.todos)) return;
    this.todos = data.todos;
    const maxId = this.todos.reduce((m, t) => Math.max(m, Number(t.id) || 0), 0);
    const saved = Number.isInteger(data.nextId) ? data.nextId : 1;
    this.nextId = Math.max(saved, maxId + 1);
  }

  save() {
    if (!this.file) return;
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify({ nextId: this.nextId, todos: this.todos }));
    fs.renameSync(tmp, this.file);
  }

  list(filter = 'all') {
    if (!FILTERS.includes(filter)) throw new Error('Filter must be one of: all, active, completed');
    if (filter === 'active') return this.todos.filter((t) => !t.completed);
    if (filter === 'completed') return this.todos.filter((t) => t.completed);
    return [...this.todos];
  }

  get(id) {
    return this.todos.find((t) => t.id === Number(id)) || null;
  }

  create(title) {
    if (typeof title !== 'string' || title.trim() === '') {
      throw new Error('Title is required');
    }
    const todo = {
      id: this.nextId++,
      title: title.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    this.todos.push(todo);
    this.save();
    return todo;
  }

  update(id, changes = {}) {
    const todo = this.get(id);
    if (!todo) return null;
    if (changes.completed !== undefined && typeof changes.completed !== 'boolean') {
      throw new Error('Completed must be a boolean');
    }
    if (changes.title !== undefined) {
      if (typeof changes.title !== 'string' || changes.title.trim() === '') {
        throw new Error('Title is required');
      }
      todo.title = changes.title.trim();
    }
    if (changes.completed !== undefined) {
      todo.completed = changes.completed;
    }
    this.save();
    return todo;
  }

  remove(id) {
    const index = this.todos.findIndex((t) => t.id === Number(id));
    if (index === -1) return false;
    this.todos.splice(index, 1);
    this.save();
    return true;
  }

  clearCompleted() {
    const before = this.todos.length;
    this.todos = this.todos.filter((t) => !t.completed);
    this.save();
    return before - this.todos.length;
  }
}

module.exports = { TodoStore };
