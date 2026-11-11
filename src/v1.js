'use strict';

const { MAX_TITLE, normalizeTitle } = require('./todoStore');

const FILTERS = ['all', 'active', 'completed'];

function toV1(todo) {
  return { id: String(todo.id), title: todo.title, done: todo.completed, createdAt: todo.createdAt };
}

// The handler resolves to true once it has answered a request under /v1/todos
// and to false for any other path. The server injects body parsing and JSON output.
function createV1Handler(store, { sendJson, readBody }) {
  async function handleV1(req, res, url) {
    const match = url.pathname.match(/^\/v1\/todos(?:\/([^/]+?)(\/toggle)?)?$/);
    if (!match) return false;
    await respond(req, res, url, match);
    return true;
  }

  async function respond(req, res, url, match) {
    const [, id, toggle] = match;
    const notFound = () => sendJson(res, 404, { error: 'Todo not found' });
    const existing = id !== undefined ? store.get(id) : null;

    try {
      if (id === undefined) {
        if (req.method === 'GET') {
          const filter = url.searchParams.get('filter') || 'all';
          if (!FILTERS.includes(filter)) return sendJson(res, 400, { error: 'Filter must be one of: all, active, completed' });
          return sendJson(res, 200, store.list(filter).map(toV1));
        }
        if (req.method === 'POST') {
          const body = await readBody(req);
          const title = normalizeTitle(body && body.title);
          if (!title) return sendJson(res, 400, { error: `Title must be 1-${MAX_TITLE} characters` });
          return sendJson(res, 201, toV1(store.create(title)));
        }
        return sendJson(res, 405, { error: 'Method not allowed' });
      }

      if (toggle) {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
        if (!existing) return notFound();
        return sendJson(res, 200, toV1(store.update(id, { completed: !existing.completed })));
      }

      if (req.method === 'PATCH') {
        const body = await readBody(req);
        if (!existing) return notFound();
        const title = normalizeTitle(body && body.title);
        if (!title) return sendJson(res, 400, { error: `Title must be 1-${MAX_TITLE} characters` });
        return sendJson(res, 200, toV1(store.update(id, { title })));
      }
      if (req.method === 'DELETE') {
        return store.remove(id) ? sendJson(res, 204) : notFound();
      }
      return sendJson(res, 405, { error: 'Method not allowed' });
    } catch (err) {
      if (err.status === 413) throw err;
      return sendJson(res, 400, { error: err.message });
    }
  }

  return handleV1;
}

module.exports = { createV1Handler };
