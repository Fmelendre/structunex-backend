# Structunex Backend

Express + MongoDB (Mongoose) API for the AI structural design MVP.
Node orchestrates and stores data; the Python `calc-service` does the actual solving.

## Requirements

- Node.js 18+
- MongoDB (local, or a MongoDB Atlas connection string)

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then edit values if needed
npm run dev            # starts on http://localhost:4000
```

## Environment (.env)

| Variable          | Default                                  | Description                     |
| ----------------- | ---------------------------------------- | ------------------------------- |
| PORT                  | 4000                                     | API port                        |
| MONGODB_URI           | mongodb://localhost:27017/structunex     | Mongo connection string         |
| CALC_SERVICE_URL      | http://localhost:8000                    | Python solver microservice      |
| CLIENT_ORIGIN         | http://localhost:5173                    | Frontend origin (CORS)          |
| CLERK_PUBLISHABLE_KEY | pk_test_...                              | Clerk publishable key           |
| CLERK_SECRET_KEY      | sk_test_...                              | Clerk secret key (backend auth) |

> Clerk keys are written to `.env.local` by `clerk init` (git-ignored). The
> table above documents them; do not commit real values.

## Authentication

All `/api/projects` routes require a valid Clerk session. The client must send
the Clerk session token on every request:

```
Authorization: Bearer <clerk-session-token>
```

`GET /api/health` stays public. The project owner (`ownerId`) is taken from the
authenticated Clerk user — it is **not** sent in the request body — and each
user can only access their own projects.

## API

The structural model is built **incrementally**: create a project (metadata
only), then add its entities through their own sub-resource routes, then run the
analysis. Every entity is addressed by its Mongo `_id`.

**Projects**

| Method | Route              | Description                              |
| ------ | ------------------ | ---------------------------------------- |
| GET    | /api/health        | Health check (public)                    |
| GET    | /api/projects      | List the caller's projects (metadata)    |
| POST   | /api/projects      | Create a project (`name`, `code`)        |
| GET    | /api/projects/:id  | Get project metadata                     |
| PATCH  | /api/projects/:id  | Update project metadata                  |
| DELETE | /api/projects/:id  | Delete project + all its children        |

**Sub-resources** — the same CRUD shape for each entity, nested under a project:

| Method | Route                                    | Description        |
| ------ | ---------------------------------------- | ------------------ |
| GET    | /api/projects/:id/`<entity>`             | List entities      |
| POST   | /api/projects/:id/`<entity>`             | Create one         |
| GET    | /api/projects/:id/`<entity>`/:entityId   | Get one            |
| PATCH  | /api/projects/:id/`<entity>`/:entityId   | Update one         |
| DELETE | /api/projects/:id/`<entity>`/:entityId   | Delete one         |

where `<entity>` ∈ `nodes | materials | sections | elements | supports | loads`.

**Analysis**

| Method | Route                        | Description                          |
| ------ | ---------------------------- | ------------------------------------ |
| GET    | /api/projects/:id/analysis   | Current status + last result         |
| POST   | /api/projects/:id/analysis   | Run the solver, store the result     |

## Data model

The structural model is **normalized**: instead of embedding everything in one
`projects` document, each entity type lives in its own collection related by
`projectId`, with indexes.

| Collection  | Holds                    | Key index                          |
| ----------- | ------------------------ | ---------------------------------- |
| `projects`  | Project metadata         | `{ ownerId, createdAt }`           |
| `nodes`     | Nodes                    | `{ projectId, id }` unique         |
| `materials` | Materials                | `{ projectId, id }` unique         |
| `sections`  | Sections                 | `{ projectId, id }` unique         |
| `elements`  | Elements                 | `{ projectId, id }` unique         |
| `supports`  | Supports                 | `{ projectId, nodeId }` unique     |
| `loads`     | Loads                    | `{ projectId }`                    |
| `results`   | Solver output (1:1)      | `{ projectId }` unique             |

The domain id (`id` / `nodeId`) is a data field with a unique index per project;
creating a duplicate is rejected by the index. Project deletion cascades to all
children in a **transaction** (requires a replica set — MongoDB Atlas, or a local
`mongod --replSet`).

## Structure

```
src/
├── index.js          # entry point (connects DB, starts server)
├── app.js            # Express config (middlewares, routes, CORS)
├── config/           # env + db connection
├── models/           # one file/collection per entity + index barrel
├── schemas/          # Zod validation (per-entity)
├── controllers/      # thin per-resource handlers + crudFactory
├── services/         # thin per-resource services + crudFactory + analysis
├── routes/           # one router per resource, nested under projects
└── middleware/       # auth (Clerk) + loadProject + validate + errorHandler
```

Sub-resource routes/controllers/services are generated from a shared `crudFactory`
so each entity stays an independent file without duplicating CRUD. Ownership is
enforced once by `loadProject`, which loads the project and checks it belongs to
the Clerk user before any sub-resource handler runs.

## Data flow

```
routes -> requireAuth -> loadProject -> validate (Zod) -> controller -> service -> (MongoDB | Python calc-service)
```

## Example: build a project incrementally

All requests need `-H "Authorization: Bearer <clerk-session-token>"`.

```bash
# 1. Create the project (metadata only) -> returns { _id, ... }
curl -X POST http://localhost:4000/api/projects \
  -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{ "name": "Portico ejemplo", "code": "E.030" }'

# 2. Add entities (use the project _id from step 1)
curl -X POST http://localhost:4000/api/projects/<projectId>/nodes \
  -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{ "id": "N1", "x": 0, "y": 0, "z": 0 }'

curl -X POST http://localhost:4000/api/projects/<projectId>/materials \
  -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{ "id": "M1", "name": "Concreto", "E": 25000000, "G": 10400000 }'

# ... sections, elements, supports, loads the same way ...

# 3. Run the analysis
curl -X POST http://localhost:4000/api/projects/<projectId>/analysis \
  -H "Authorization: Bearer <token>"
```
