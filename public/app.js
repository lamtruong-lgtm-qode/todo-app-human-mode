'use strict';

const API = '/v1/todos';

const listEl = document.getElementById('todo-list');
const doneListEl = document.getElementById('done-list');
const activeState = document.getElementById('active-state');
const doneState = document.getElementById('done-state');
const statValue = document.getElementById('stat-value');
const addForm = document.getElementById('add-form');
const newTitle = document.getElementById('new-title');
const addBtn = document.getElementById('add-btn');
const addSpin = document.querySelector('[data-testid="todos.addSpin"]');
const addError = document.getElementById('add-error');
const toggleError = document.getElementById('toggle-error');
const delError = document.getElementById('del-error');
const clearDoneBtn = document.getElementById('clear-done-btn');
const clearError = document.getElementById('clear-error');
const toasts = document.getElementById('toasts');
const modalRoot = document.getElementById('modal-root');

let loadSeq = 0;
let openMenu = null;

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'testid') node.setAttribute('data-testid', value);
    else if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

// Resolves to {ok, data}; never throws.
async function api(path, options = {}) {
  try {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
    if (res.status === 204) return { ok: true, data: null };
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    return { ok: res.ok, data };
  } catch (_) {
    return { ok: false, data: null };
  }
}

function toast(message) {
  const node = el('div', { class: 'toast', text: message });
  toasts.appendChild(node);
  setTimeout(() => node.remove(), 4000);
}

function closeMenu() {
  if (!openMenu) return;
  openMenu.menu.remove();
  openMenu.button.setAttribute('aria-expanded', 'false');
  openMenu = null;
}

// Each card has its own state slot; n is 1 for Active and 2 for Done.
const CARDS = [
  { n: 1, slot: activeState, loadingLabel: 'Loading todos', emptyId: 'todos.emptyMsg', emptyText: 'Nothing to do yet. Add your first todo.', errNote: 'todos.listErrNote', retry: 'todos.listRetry', skel: 'todos.listSkel' },
  { n: 2, slot: doneState, loadingLabel: 'Loading finished todos', emptyId: 'todos.doneEmpty', emptyText: 'Finished todos show up here.', errNote: 'todos.doneErrNote', retry: 'todos.doneRetry', skel: 'todos.doneSkel' },
];

function renderState(card, kind) {
  card.slot.innerHTML = '';
  if (kind === 'loading') {
    const skel = el('div', { testid: card.skel, 'aria-hidden': 'true', class: 'skeleton' });
    for (let i = 0; i < 3; i += 1) skel.appendChild(el('div', { class: 'skel-row' }));
    card.slot.appendChild(el('div', { testid: `todos.loading-${card.n}`, role: 'status', 'aria-label': card.loadingLabel }, skel));
  } else if (kind === 'error') {
    const retry = el('button', { type: 'button', testid: card.retry, text: 'Retry' });
    retry.addEventListener('click', load);
    card.slot.appendChild(
      el('div', { testid: `todos.error-${card.n}`, class: 'state error-state' },
        el('p', { testid: card.errNote, role: 'alert', text: 'Could not load your todos' }),
        retry),
    );
  } else if (kind === 'empty') {
    card.slot.appendChild(
      el('div', { testid: `todos.empty-${card.n}`, class: 'state' },
        el('p', { testid: card.emptyId, text: card.emptyText })),
    );
  }
}

function renderRow(todo) {
  const id = todo.id;
  const done = todo.done;
  const title = el('span', { testid: done ? 'todos.doneTitle' : 'todos.rowTitle', class: 'row-title', text: todo.title });

  const toggle = done
    ? el('button', { type: 'button', testid: 'todos.reopenBtn', text: 'Undo', 'aria-label': `Undo "${todo.title}"` })
    : el('button', { type: 'button', testid: 'todos.toggleBtn', text: 'Done', 'aria-label': `Mark "${todo.title}" as done` });
  toggle.addEventListener('click', () => toggleTodo(todo));

  const menuBtn = el('button', {
    type: 'button',
    testid: done ? 'todos.doneActs' : 'todos.rowActs',
    class: 'row-menu-btn',
    'aria-label': 'Row actions',
    'aria-haspopup': 'menu',
    'aria-expanded': 'false',
    'data-todo-id': id,
    text: '\u22ef',
  });
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu(menuBtn, todo);
  });
  const acts = el('span', { class: 'row-acts' }, menuBtn);

  const children = done
    ? [el('span', { testid: 'todos.doneBadge', class: 'badge done', text: 'Done' }), title, toggle, acts]
    : [title, toggle, acts];
  return el('li', {
    testid: done ? 'todos.doneLine' : 'todos.line',
    class: `line${done ? ' is-done' : ''}`,
    'aria-label': todo.title,
    'data-todo-id': id,
  }, ...children);
}

function toggleMenu(button, todo) {
  if (openMenu && openMenu.button === button) return closeMenu();
  closeMenu();
  const edit = el('button', { type: 'button', role: 'menuitem', text: 'Edit' });
  const del = el('button', { type: 'button', role: 'menuitem', text: 'Delete' });
  const menu = el('div', { role: 'menu', class: 'row-menu', 'aria-label': 'Row actions' }, ...(todo.done ? [del] : [edit, del]));
  edit.addEventListener('click', () => {
    closeMenu();
    openEditModal(todo, button);
  });
  del.addEventListener('click', () => {
    closeMenu();
    openDeleteModal(todo, button);
  });
  button.parentElement.appendChild(menu);
  button.setAttribute('aria-expanded', 'true');
  openMenu = { menu, button };
  edit.focus();
}

async function load() {
  const seq = ++loadSeq;
  listEl.innerHTML = '';
  doneListEl.innerHTML = '';
  for (const card of CARDS) renderState(card, 'loading');
  const res = await api(`${API}?filter=all`);
  if (seq !== loadSeq) return;
  if (!res.ok || !Array.isArray(res.data)) {
    for (const card of CARDS) renderState(card, 'error');
    statValue.textContent = '0';
    clearDoneBtn.hidden = true;
    return;
  }
  const todos = res.data;
  const active = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);
  renderState(CARDS[0], active.length === 0 ? 'empty' : 'none');
  renderState(CARDS[1], done.length === 0 ? 'empty' : 'none');
  statValue.textContent = String(todos.length);
  clearDoneBtn.hidden = done.length === 0;
  for (const todo of active) listEl.appendChild(renderRow(todo));
  for (const todo of done) doneListEl.appendChild(renderRow(todo));
}

async function toggleTodo(todo) {
  toggleError.hidden = true;
  delError.hidden = true;
  const res = await api(`${API}/${todo.id}/toggle`, { method: 'POST' });
  if (!res.ok) {
    toggleError.hidden = false;
    toast('Could not update the todo');
    return;
  }
  load();
}

function syncAddButton() {
  addBtn.disabled = newTitle.value.trim() === '';
}

newTitle.addEventListener('input', () => {
  addError.hidden = true;
  syncAddButton();
});

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = newTitle.value.trim();
  if (!title || addBtn.disabled) return;
  addBtn.disabled = true;
  addSpin.hidden = false;
  addError.hidden = true;
  const res = await api(API, { method: 'POST', body: JSON.stringify({ title }) });
  addSpin.hidden = true;
  if (!res.ok) {
    addError.hidden = false;
    newTitle.setAttribute('aria-invalid', 'true');
    newTitle.setAttribute('aria-describedby', 'add-error');
    syncAddButton();
    return;
  }
  newTitle.removeAttribute('aria-invalid');
  newTitle.removeAttribute('aria-describedby');
  newTitle.value = '';
  syncAddButton();
  load();
});

document.addEventListener('click', closeMenu);

// ---- modals -------------------------------------------------------------

let activeModal = null;

function focusables(root) {
  return [...root.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])')].filter((n) => !n.disabled && !n.hidden);
}

function closeModal() {
  if (!activeModal) return;
  const { backdrop, opener, todoId } = activeModal;
  backdrop.remove();
  activeModal = null;
  const target = opener && opener.isConnected
    ? opener
    : document.querySelector(`.row-menu-btn[data-todo-id="${todoId}"]`) || newTitle;
  target.focus();
}

function openModal({ prefix, titleText, body, buttons, opener, todoId, initialFocus, actionsTestid }) {
  closeModal();
  closeMenu();
  const titleId = `${prefix}-title`;
  const dialog = el('div', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, testid: `${prefix}.dialog`, class: 'modal' },
    el('h2', { id: titleId, text: titleText }),
    body,
    el('div', actionsTestid ? { class: 'modal-actions', testid: actionsTestid } : { class: 'modal-actions' }, ...buttons));
  const backdrop = el('div', { class: 'backdrop' }, dialog);
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) closeModal();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = focusables(dialog);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  modalRoot.appendChild(backdrop);
  activeModal = { backdrop, opener, todoId };
  (initialFocus || focusables(dialog)[0]).focus();
  return dialog;
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (activeModal) {
    e.preventDefault();
    closeModal();
  } else if (openMenu) {
    const { button } = openMenu;
    closeMenu();
    button.focus();
  }
});

function openEditModal(todo, opener) {
  const input = el('input', {
    type: 'text',
    testid: 'editTodo.editTitle',
    maxlength: '200',
    required: '',
    'aria-label': 'Title',
    autocomplete: 'off',
  });
  input.value = todo.title;
  const err = el('p', { class: 'field-error', id: 'edit-title-err', text: 'Title is required', hidden: '' });
  const saveErr = el('p', { class: 'field-error', testid: 'editTodo.saveErrNote', role: 'alert', text: 'Could not save. Try again.', hidden: '' });
  const spin = el('span', { class: 'spin', testid: 'editTodo.saveSpin', role: 'status', 'aria-label': 'Saving', hidden: '' });
  const cancel = el('button', { type: 'button', testid: 'editTodo.editCancel', text: 'Cancel' });
  const save = el('button', { type: 'button', testid: 'editTodo.editSave', class: 'primary', text: 'Save' });
  const body = el('div', { class: 'modal-body' }, input, err, saveErr);

  const sync = () => {
    const empty = input.value.trim() === '';
    err.hidden = !empty;
    save.disabled = empty;
    if (empty) input.setAttribute('aria-describedby', 'edit-title-err');
    else input.removeAttribute('aria-describedby');
  };
  const submit = async () => {
    const title = input.value.trim();
    if (!title || save.disabled) return;
    save.disabled = true;
    spin.hidden = false;
    saveErr.hidden = true;
    const res = await api(`${API}/${todo.id}`, { method: 'PATCH', body: JSON.stringify({ title }) });
    spin.hidden = true;
    if (!res.ok) {
      saveErr.hidden = false;
      save.disabled = false;
      return;
    }
    closeModal();
    load();
  };
  input.addEventListener('input', () => {
    saveErr.hidden = true;
    sync();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
  cancel.addEventListener('click', closeModal);
  save.addEventListener('click', submit);

  openModal({ prefix: 'editTodo', titleText: 'Edit todo', body, buttons: [el('span', { class: 'spacer', testid: 'editTodo.editPush' }), spin, cancel, save], actionsTestid: 'editTodo.editActions', opener, todoId: todo.id, initialFocus: input });
  input.select();
  sync();
}

function openDeleteModal(todo, opener) {
  const body = el('div', { class: 'modal-body' },
    el('p', { testid: 'confirmDelete.cdBody', text: 'This cannot be undone.' }));
  const cancel = el('button', { type: 'button', testid: 'confirmDelete.cancel', text: 'Keep it' });
  const confirm = el('button', { type: 'button', testid: 'confirmDelete.confirm', class: 'danger', text: 'Delete' });
  cancel.addEventListener('click', closeModal);
  confirm.addEventListener('click', async () => {
    confirm.disabled = true;
    delError.hidden = true;
    const res = await api(`${API}/${todo.id}`, { method: 'DELETE' });
    if (!res.ok) {
      closeModal();
      delError.hidden = false;
      return;
    }
    closeModal();
    toast('Todo deleted');
    load();
  });
  openModal({ prefix: 'confirmDelete', titleText: 'Delete this todo?', body, buttons: [cancel, confirm], opener, todoId: todo.id, initialFocus: cancel });
}

function openClearDoneModal(opener) {
  const body = el('div', { class: 'modal-body' },
    el('p', { testid: 'clearDone.body', text: 'All done todos will be removed. This cannot be undone.' }));
  const cancel = el('button', { type: 'button', testid: 'clearDone.cancel', text: 'Keep them' });
  const confirm = el('button', { type: 'button', testid: 'clearDone.confirm', class: 'danger', text: 'Clear done' });
  cancel.addEventListener('click', closeModal);
  confirm.addEventListener('click', async () => {
    confirm.disabled = true;
    clearError.hidden = true;
    const res = await api(API, { method: 'DELETE' });
    closeModal();
    if (!res.ok || !res.data || typeof res.data.removed !== 'number') {
      clearError.hidden = false;
      return;
    }
    const n = res.data.removed;
    toast(`Cleared ${n} todos`);
    load();
  });
  openModal({ prefix: 'clearDone', titleText: 'Clear done todos?', body, buttons: [cancel, confirm], opener, initialFocus: cancel });
}

clearDoneBtn.addEventListener('click', () => {
  clearError.hidden = true;
  openClearDoneModal(clearDoneBtn);
});

load();
