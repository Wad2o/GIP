# Auth API

Signup and login endpoints with bcrypt password hashing and JWT issuing and verification. Express 5, in-memory user store.

```bash
npm install
JWT_SECRET="a-long-random-string" npm start     # http://localhost:3000   (Windows: set JWT_SECRET=... first)
npm test
```
`JWT_SECRET` is required when `NODE_ENV=production`. Optional: `PORT`, `JWT_EXPIRES_IN` (default `1h`).

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | no | `{ name, email, password }` -> `201 { user, token }` |
| POST | `/api/auth/login` | no | `{ email, password }` -> `200 { user, token }` |
| GET | `/api/auth/me` | Bearer | current user |
| GET | `/api/auth/verify` | Bearer | `{ valid: true, payload }` (decoded token) |
| GET | `/api/health` | no | health check |

```bash
curl -X POST localhost:3000/api/auth/signup -H 'content-type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com","password":"correct horse"}'
curl localhost:3000/api/auth/me -H "authorization: Bearer <token>"
```

## Security notes
- Passwords are hashed with bcrypt (cost 10); the hash is never returned.
- JWTs are signed with HS256, carry the user id as `sub`, and expire (default 1 h). Verification pins the algorithm, so `alg: none` and forged tokens are rejected.
- Wrong password and unknown email return the same 401, and login spends the same time in both cases.
- Emails are trimmed and lowercased, so `Alice@x.com` and `alice@x.com` are the same account (409 on duplicates).
- Passwords longer than 72 bytes are refused (bcrypt would silently ignore the rest).
- Signup and login are rate limited; `helmet` sets security headers.
- Users live in memory (`src/store.js`) and reset on restart. Replace that file with a database to persist them.

Structure: `routes/` -> `controllers/` -> `services/`, plus `middleware/` (validation, authentication, errors).
