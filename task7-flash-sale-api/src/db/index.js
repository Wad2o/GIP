const Database = require('better-sqlite3');
const config = require('../config');

// timeout: when another process holds the write lock, wait (up to 10 s) instead of failing.
const db = new Database(config.DB_FILE, { timeout: 10000 });
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    -- last line of defence: the database itself refuses a negative stock
    stock       INTEGER NOT NULL CHECK (stock >= 0),
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    product_id       INTEGER NOT NULL REFERENCES products(id),
    quantity         INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL,
    total_cents      INTEGER NOT NULL,
    idempotency_key  TEXT NOT NULL,
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    -- the same customer sending the same key twice can never create two orders
    UNIQUE (user_id, idempotency_key)
  );
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
`);

const DEMO_PRODUCTS = [
  ['Wireless Headphones', 'Noise cancelling, 30 h battery', 12900, 5],
  ['Mechanical Keyboard', 'Hot-swappable, RGB', 8900, 3],
  ['4K Monitor 27"', 'IPS, 144 Hz', 34900, 10],
  ['USB-C Cable 2 m', 'Fast charging', 900, 100],
];

if (config.SEED) {
  db.transaction(() => {
    if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n > 0) return;
    const insert = db.prepare('INSERT INTO products (name, description, price_cents, stock) VALUES (?, ?, ?, ?)');
    DEMO_PRODUCTS.forEach((p) => insert.run(...p));
  }).immediate();
}

module.exports = db;
