const db = require('../db');
const AppError = require('../utils/AppError');

const SELECT = 'SELECT o.*, p.name AS product_name FROM orders o JOIN products p ON p.id = o.product_id';
const byKey = db.prepare(`${SELECT} WHERE o.user_id = ? AND o.idempotency_key = ?`);
const byId = db.prepare(`${SELECT} WHERE o.id = ?`);
const byUser = db.prepare(`${SELECT} WHERE o.user_id = ? ORDER BY o.id DESC`);
const getProduct = db.prepare('SELECT id, price_cents, stock FROM products WHERE id = ?');
// The heart of the flash sale: check and decrement in ONE statement.
// It only changes a row when enough stock is left, so stock can never go below zero,
// even with hundreds of simultaneous requests.
const takeStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
const insertOrder = db.prepare(`
  INSERT INTO orders (user_id, product_id, quantity, unit_price_cents, total_cents, idempotency_key)
  VALUES (?, ?, ?, ?, ?, ?)`);

const toOrder = (r) => ({
  id: r.id,
  productId: r.product_id,
  productName: r.product_name,
  quantity: r.quantity,
  unitPriceCents: r.unit_price_cents,
  totalCents: r.total_cents,
  createdAt: r.created_at,
});

// BEGIN IMMEDIATE (see .immediate() below) takes the write lock first, so everything inside runs
// as one unit, also across several server processes sharing the same database file.
// Any thrown error rolls the whole transaction back: no stock is taken, no order is created.
const placeTransaction = db.transaction((userId, { productId, quantity }, key) => {
  // 1. Retry protection: same customer + same key -> return the order already created.
  const existing = byKey.get(userId, key);
  if (existing) {
    if (existing.product_id !== productId || existing.quantity !== quantity) {
      throw new AppError(422, 'IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for a different order');
    }
    return { order: toOrder(existing), replayed: true };
  }

  // 2. Take the stock atomically.
  const product = getProduct.get(productId);
  if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  if (takeStock.run(quantity, productId, quantity).changes === 0) {
    const { stock } = getProduct.get(productId);
    if (stock === 0) throw new AppError(409, 'SOLD_OUT', 'Sorry, this product is sold out');
    throw new AppError(409, 'INSUFFICIENT_STOCK', `Only ${stock} unit${stock === 1 ? '' : 's'} left, please reduce the quantity`);
  }

  // 3. Record the order.
  const { lastInsertRowid } = insertOrder.run(userId, productId, quantity, product.price_cents, product.price_cents * quantity, key);
  return { order: toOrder(byId.get(lastInsertRowid)), replayed: false };
});

const place = (userId, input, key) => placeTransaction.immediate(userId, input, key);

const listForUser = (userId) => byUser.all(userId).map(toOrder);

function getForUser(userId, orderId) {
  const row = byId.get(orderId);
  // someone else's order looks exactly like a missing one
  if (!row || row.user_id !== userId) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  return toOrder(row);
}

module.exports = { place, listForUser, getForUser };
