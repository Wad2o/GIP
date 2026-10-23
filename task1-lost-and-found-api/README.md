# Lost & Found API

REST API to report lost items, report found items, search and filter reports, view item details, update your own reports and mark an item as recovered.

**Stack:** Node.js, Express 5, Prisma (SQLite), JWT auth, Zod validation, Swagger UI docs.

## Quick start

```bash
npm install
cp .env.example .env          # Windows: copy .env.example .env
npx prisma migrate deploy     # creates prisma/dev.db from the included migration
npm run db:seed               # optional demo data (users Alice/Bob, password "password123")
npm start                     # http://localhost:3000
```

- Interactive docs (Swagger UI): http://localhost:3000/api/docs
- Ready-made requests: `requests.http` (VS Code REST Client extension)
- Tests: `npm test`

## Project structure

```
prisma/
  schema.prisma        User and Report models, ReportType and ReportStatus enums
  migrations/          SQL migration
  seed.js              demo data
src/
  config/              env.js (settings), prisma.js (database client)
  routes/              URL -> middleware -> controller
  controllers/         HTTP layer: read the request, send the response
  services/            business logic and database access (Prisma)
  middleware/          auth, validation, file upload, error handling
  validators/          Zod schemas for params, query and body
  docs/                OpenAPI description (Swagger UI)
  utils/AppError.js    error with an HTTP status
  app.js               Express setup
  server.js            starts the server, graceful shutdown
test/api.test.js       end-to-end tests
```

A request flows: `route -> auth? -> upload? -> validate -> controller -> service -> Prisma`.
Any error thrown on the way ends up in one place, `middleware/errorHandler.js`.

## Data model

- **User**: `id`, `name`, `phone` (unique), `password` (bcrypt hash, never returned), `createdAt`, `reports`
- **Report**: `id`, `itemName`, `imageUrl`, `type` (`LOST` | `FOUND`), `status` (`RECOVERED` | `NOT_RECOVERED`), `description`, `place`, `date` (when it was lost or found), `createdAt`, `updatedAt`, `userId` (foreign key to User)

## Endpoints (all under `/api`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | no | Create an account, returns `{ user, token }` |
| POST | `/auth/login` | no | Log in, returns `{ user, token }` |
| GET | `/users/me` | yes | Current user with their reports |
| POST | `/items` | yes | Report a lost or found item (JSON, or multipart with an `image` file) |
| GET | `/items` | no | Search, filter and paginate |
| GET | `/items/:id` | no | Item details, including who reported it |
| PATCH | `/items/:id` | owner | Update own report (only fields provided and not null/empty change) |
| PATCH | `/items/:id/recover` | owner | Mark as `RECOVERED` |
| GET | `/health` | no | Health check |

Authenticated routes need `Authorization: Bearer <token>`.

### Search and filter: `GET /items`

| Param | Meaning |
|---|---|
| `q` | text search in name, description and place (case-insensitive) |
| `type` | `LOST` or `FOUND` |
| `status` | `RECOVERED` or `NOT_RECOVERED` |
| `place` | text search in place |
| `from`, `to` | date range on the lost/found date; `to=2026-10-12` includes that whole day |
| `userId` | only one user's reports |
| `page`, `limit` | pagination (defaults 1 and 20, max limit 100) |

Filters combine with AND. Results are newest first and returned as `{ items, meta: { page, limit, total, totalPages } }`.

```bash
curl "http://localhost:3000/api/items?type=LOST&q=wallet&from=2026-10-01"
```

## Error format

Every error has the same shape:

```json
{ "error": { "status": 400, "message": "Validation failed", "details": [{ "field": "type", "message": "type must be one of: LOST, FOUND" }] } }
```

| Status | When |
|---|---|
| 400 | invalid body, query or id; malformed JSON; wrong file type |
| 401 | missing, invalid or expired token; wrong login |
| 403 | modifying someone else's report |
| 404 | item or route not found |
| 409 | phone already registered; item already recovered |
| 413 | image larger than 5 MB |
| 429 | too many login/register attempts |
| 500 | unexpected error (details are only logged, never sent) |

## Design notes

- **Auth:** the brief doesn't mention login, but "update their own reports" needs to know who the caller is, so there is simple phone + password registration with JWT. Passwords are hashed with bcrypt. Login and register are rate limited.
- **Ownership** is enforced in the service layer: unknown item gives 404, someone else's gives 403.
- **Images:** send a file in the `image` form field (jpeg/png/webp/gif, max 5 MB) or just an `imageUrl`. Uploads are stored in `uploads/` and served at `/uploads/...`. A file is deleted again if the request fails.
- **Reporter contact:** item details expose the reporter's name and phone, since contacting them is the point of a lost-and-found board.
- **Database:** SQLite keeps setup to zero. The code uses Prisma's Rust-free client (`engineType = "client"`) with the `better-sqlite3` driver adapter. Switching to PostgreSQL means changing the datasource provider, the adapter in `src/config/prisma.js`, and regenerating the migration.
- **Not included** (not in the brief): deleting reports, password reset, email verification.

## Scripts

| Script | What it does |
|---|---|
| `npm start` | run the server |
| `npm run dev` | run with auto-restart on file changes |
| `npm test` | run the end-to-end tests (uses a temporary database) |
| `npm run db:migrate` | apply migrations (`prisma migrate deploy`) |
| `npm run db:seed` | insert demo data |
