# Todo App

A simple todo app built with Node.js — no external dependencies.

## Requirements

- Node.js 18+

## Run

```bash
npm start
# open http://localhost:3000
```

## Test

```bash
npm test
```

## REST API v1

Base path `/v1/todos`. Requests and responses are JSON.

| Method | Path                                          | Description                                        | Success |
| ------ | --------------------------------------------- | -------------------------------------------------- | ------- |
| GET    | `/v1/todos?filter=all\|active\|completed`     | List todos; `filter` defaults to `all`             | 200     |
| POST   | `/v1/todos`                                   | Create `{ "title": "..." }`                        | 201     |
| PATCH  | `/v1/todos/:id`                               | Rename `{ "title": "..." }`                        | 200     |
| POST   | `/v1/todos/:id/toggle`                        | Flip `done` on one todo                            | 200     |
| DELETE | `/v1/todos/:id`                               | Delete one todo                                    | 204, no body |
| DELETE | `/v1/todos`                                   | Clear all done todos; returns `{ "removed": n }`    | 200     |

A todo looks like:

```json
{ "id": "1", "title": "Buy milk", "done": false, "createdAt": "..." }
```

`id` is a string, `done` is a boolean and `createdAt` is the creation timestamp stored for the todo.

The title is trimmed and must be 1-200 characters long. It is required on create and on PATCH.

Errors are returned as `{ "error": "message" }` with one of these status codes:

| Status | Meaning |
| ------ | ------- |
| 400    | Invalid title (not a string, empty or longer than 200 characters), unknown `filter` value, or an unreadable request body |
| 404    | No todo with that id (PATCH, toggle, DELETE) |
| 405    | Method not supported on that path, for example `PUT /v1/todos/:id` or `GET /v1/todos/:id/toggle` |
| 413    | Request body too large |

## REST API (legacy)

The `/api/todos` endpoints below are legacy. They keep working for existing clients; use `/v1/todos` for new code.

| Method | Path                          | Description              |
| ------ | ----------------------------- | ------------------------ |
| GET    | `/api/todos?filter=all\|active\|completed` | List todos |
| POST   | `/api/todos`                  | Create `{ "title": "..." }` |
| GET    | `/api/todos/:id`              | Get one todo             |
| PATCH  | `/api/todos/:id`              | Update `{ title?, completed? }` |
| DELETE | `/api/todos/:id`              | Delete one todo          |
| DELETE | `/api/todos`                  | Clear completed todos    |

By default data is stored in memory and resets when the server restarts.

## Persistence

Set `DATA_FILE` to a file path to keep todos across restarts:

```bash
DATA_FILE=./todos.json npm start
```

The file holds `{ "nextId": n, "todos": [...] }` and is rewritten atomically (temp file, then rename) after every change. Ids keep increasing and are never reused. A missing or corrupt file starts the store empty.
