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

## REST API

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
