const list = document.getElementById('todo-list');
const form = document.getElementById('new-todo-form');
const input = document.getElementById('new-todo');
const count = document.getElementById('count');
const clearBtn = document.getElementById('clear-completed');
const filterButtons = document.querySelectorAll('.filters button');

let currentFilter = 'all';

const errorBox = document.getElementById('error');

function showError(message, key) {
  errorBox.innerHTML = '';
  const text = document.createElement('span');
  text.textContent = message;
  text.setAttribute('data-testid', `error-message-${key}`);
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = 'Dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss error');
  dismiss.setAttribute('data-testid', `error-dismiss-${key}`);
  dismiss.addEventListener('click', clearError);
  errorBox.append(text, dismiss);
  errorBox.hidden = false;
}

function clearError() {
  errorBox.hidden = true;
  errorBox.innerHTML = '';
}

// Resolves to {ok, data}; never throws. Failures surface via showError.
async function api(path, options = {}, key = 'list') {
  try {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (res.status === 204) return { ok: true, data: null };
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    if (!res.ok) {
      showError((data && data.error) || `Request failed (${res.status})`, key);
      return { ok: false, data };
    }
    return { ok: true, data };
  } catch (_) {
    showError('Network error. Please try again.', key);
    return { ok: false, data: null };
  }
}

function startEdit(todo, label, li) {
  const edit = document.createElement('input');
  edit.type = 'text';
  edit.value = todo.title;
  edit.className = 'edit';
  edit.setAttribute('aria-label', `Edit title for ${todo.title}`);
  edit.setAttribute('data-testid', `edit-input-${todo.id}`);
  let done = false;

  const finish = async (save) => {
    if (done) return;
    done = true;
    if (!save) return render();
    const title = edit.value.trim();
    if (!title) {
      showError('Title cannot be empty.', todo.id);
      return render();
    }
    if (title === todo.title) return render();
    const res = await api(
      `/api/todos/${todo.id}`,
      { method: 'PATCH', body: JSON.stringify({ title }) },
      todo.id,
    );
    if (res.ok) clearError();
    render();
  };

  edit.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });
  edit.addEventListener('blur', () => finish(true));
  li.replaceChild(edit, label);
  edit.focus();
  edit.select();
}

async function render() {
  const res = await api('/api/todos?filter=all', {}, 'list');
  if (!res.ok || !Array.isArray(res.data)) return;
  const all = res.data;
  const left = all.filter((t) => !t.completed).length;
  const todos = all.filter((t) =>
    currentFilter === 'active' ? !t.completed : currentFilter === 'completed' ? t.completed : true,
  );
  list.innerHTML = '';
  for (const todo of todos) {
    const li = document.createElement('li');
    li.className = todo.completed ? 'completed' : '';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.setAttribute('aria-label', `Mark "${todo.title}" as completed`);
    checkbox.addEventListener('change', async () => {
      const r = await api(
        `/api/todos/${todo.id}`,
        { method: 'PATCH', body: JSON.stringify({ completed: checkbox.checked }) },
        todo.id,
      );
      if (r.ok) render();
      else checkbox.checked = todo.completed;
    });

    const label = document.createElement('span');
    label.textContent = todo.title;
    label.addEventListener('dblclick', () => startEdit(todo, label, li));

    const del = document.createElement('button');
    del.textContent = '×';
    del.className = 'delete';
    del.setAttribute('aria-label', `Delete "${todo.title}"`);
    del.addEventListener('click', async () => {
      const r = await api(`/api/todos/${todo.id}`, { method: 'DELETE' }, todo.id);
      if (r.ok) render();
    });

    li.append(checkbox, label, del);
    list.appendChild(li);
  }
  count.textContent = `${left} item${left === 1 ? '' : 's'} left`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = input.value.trim();
  if (!title) return;
  const r = await api('/api/todos', { method: 'POST', body: JSON.stringify({ title }) }, 'new');
  if (!r.ok) return;
  input.value = '';
  render();
});

clearBtn.addEventListener('click', async () => {
  const r = await api('/api/todos', { method: 'DELETE' }, 'completed');
  if (r.ok) render();
});

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

render();
