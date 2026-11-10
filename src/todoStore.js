'use strict';

const FILTERS = ['all', 'active', 'completed'];

class TodoStore {
  constructor() {
    this.todos = [];
    this.nextId = 1;
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
    return todo;
  }

  remove(id) {
    const index = this.todos.findIndex((t) => t.id === Number(id));
    if (index === -1) return false;
    this.todos.splice(index, 1);
    return true;
  }

  clearCompleted() {
    const before = this.todos.length;
    this.todos = this.todos.filter((t) => !t.completed);
    return before - this.todos.length;
  }
}

module.exports = { TodoStore };
