# Flash Sale API

Backend for an online store running a limited-time flash sale. Customers can browse products, see the available stock, place an order and view their orders, while hundreds of them try to buy the same few units at the same moment.

Express 5, SQLite (`better-sqlite3`), no ORM, plain parameterized SQL.

```bash
npm install
npm start          # http://localhost:3000   (creates data.sqlite and 4 demo products)
npm test           # unit + concurrency tests, including 3 server processes on one database
npm run demo       # (while the server runs) 300 customers fight for the 5 headphones
```
Optional env vars: `PORT`, `DB_FILE`, `MAX_QUANTITY` (max units per order, default 5), `SEED=false`.

## How each requirement is met

| Requirement | How |
|---|---|
| Stock never goes negative | One statement does check and decrement: `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`. If it changes no row, there isn't enough stock. There is no "read the stock, then write it" gap. A `CHECK (stock >= 0)` constraint is a second safety net in the database itself. |
| A product is never oversold | The stock update and the order insert run in one `BEGIN IMMEDIATE` transaction. It takes the write lock first, so it is also safe with several server processes on the same database. Any error rolls both back. |
| Simultaneous requests handled correctly | See above, plus tests: 200 buyers for 5 units gives exactly 5 orders, and 300 requests spread over 3 server processes gives exactly 5 orders. |
| Clear message when sold out | `409` with `code: "SOLD_OUT"` and the message "Sorry, this product is sold out". Asking for more than what is left gives `INSUFFICIENT_STOCK` ("Only 2 units left..."). |
| Retries don't create duplicate orders | Every order needs an `Idempotency-Key` header. The pair (customer, key) is `UNIQUE`. Sending the same key again returns the original order (`200`, header `Idempotent-Replay: true`) and takes no more stock, even if the product has sold out in between. The same key with a different order gives `422`. |

## Endpoints (all under `/api`)

| Method | Path | Notes |
|---|---|---|
| POST | `/users` | `{ "name": "Alice" }` -> creates a customer, returns its `id` |
| GET | `/products` | all products with `stock` and `available` |
| GET | `/products/:id` | one product |
| GET | `/products/:id/stock` | `{ productId, stock, available }` |
| POST | `/orders` | needs `X-User-Id` and `Idempotency-Key` headers; body `{ "productId": 1, "quantity": 1 }` (quantity optional, 1 to 5) |
| GET | `/orders` | my orders, newest first |
| GET | `/orders/:id` | one of my orders (someone else's gives 404) |
| GET | `/health` | health check |

```bash
curl -X POST localhost:3000/api/users -H 'content-type: application/json' -d '{"name":"Alice"}'      # -> id 1

curl -X POST localhost:3000/api/orders \
  -H 'content-type: application/json' -H 'x-user-id: 1' -H "idempotency-key: $(uuidgen)" \
  -d '{"productId":1,"quantity":1}'
```
Send the same `Idempotency-Key` again to see the retry protection. Errors always look like
`{ "error": { "status": 409, "code": "SOLD_OUT", "message": "..." } }`.

| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR`, `IDEMPOTENCY_KEY_REQUIRED`, `MALFORMED_JSON` |
| 401 | `UNAUTHENTICATED` |
| 404 | `PRODUCT_NOT_FOUND`, `ORDER_NOT_FOUND`, `ROUTE_NOT_FOUND` |
| 409 | `SOLD_OUT`, `INSUFFICIENT_STOCK` |
| 422 | `IDEMPOTENCY_KEY_REUSED` |

## Design notes
- **Customers** are identified by the `X-User-Id` header to keep the focus on concurrency. The Auth API task shows how to add JWT; its middleware can replace `middleware/currentUser.js`.
- **Why SQLite:** it needs no setup, and its write lock makes the transaction logic easy to prove. The same `UPDATE ... WHERE stock >= ?` works unchanged on PostgreSQL or MySQL if the API ever runs on several machines.
- **Not included:** payments, restocking endpoints, expiry of old idempotency keys, rate limiting.

Structure: `routes/` -> `controllers/` -> `services/` (the order logic lives in `services/orders.service.js`), plus `middleware/`, `db/` and `validators.js`.
