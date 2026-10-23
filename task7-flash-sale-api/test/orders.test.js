const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flash-'));
process.env.NODE_ENV = 'test';
process.env.DB_FILE = path.join(tmp, 'test.db');
process.env.SEED = 'false';

const app = require('../src/app');
const db = require('../src/db');

const newKey = () => crypto.randomUUID();
const addUser = (name = 'Customer') => db.prepare('INSERT INTO users (name) VALUES (?)').run(name).lastInsertRowid;
const addProduct = (stock, price = 1000) => db.prepare('INSERT INTO products (name, price_cents, stock) VALUES (?, ?, ?)').run('Item', price, stock).lastInsertRowid;
const stockOf = (id) => db.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock;
const orderCount = (pid) => db.prepare('SELECT COUNT(*) AS n FROM orders WHERE product_id = ?').get(pid).n;
const unitsSold = (pid) => db.prepare('SELECT COALESCE(SUM(quantity), 0) AS n FROM orders WHERE product_id = ?').get(pid).n;

describe('Flash Sale API', () => {
  let server, base;

  const call = async (method, url, { body, user, key, headers = {} } = {}) => {
    const h = { ...headers };
    if (user) h['x-user-id'] = String(user);
    if (key) h['idempotency-key'] = key;
    if (body !== undefined) h['content-type'] = 'application/json';
    const res = await fetch(base + url, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json(), res };
  };
  const order = (user, productId, quantity, key = newKey()) => call('POST', '/orders', { user, key, body: { productId, quantity } });

  before(() => { server = app.listen(0); base = `http://localhost:${server.address().port}/api`; });
  after(() => { server.close(); db.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

  describe('browsing', () => {
    it('lists products with stock and availability', async () => {
      const pid = addProduct(3);
      const r = await call('GET', '/products');
      assert.strictEqual(r.status, 200);
      const p = r.json.find((x) => x.id === pid);
      assert.strictEqual(p.stock, 3);
      assert.strictEqual(p.available, true);
    });
    it('shows one product and its stock; unknown product -> 404', async () => {
      const pid = addProduct(0);
      assert.deepStrictEqual((await call('GET', `/products/${pid}/stock`)).json, { productId: pid, stock: 0, available: false });
      assert.strictEqual((await call('GET', `/products/${pid}`)).json.available, false);
      assert.strictEqual((await call('GET', '/products/99999')).status, 404);
      assert.strictEqual((await call('GET', '/products/abc')).status, 400);
    });
    it('creates a customer', async () => {
      assert.strictEqual((await call('POST', '/users', { body: { name: 'Alice' } })).status, 201);
      assert.strictEqual((await call('POST', '/users', { body: { name: 'A' } })).status, 400);
    });
  });

  describe('placing an order', () => {
    it('needs a known customer', async () => {
      const pid = addProduct(1);
      assert.strictEqual((await call('POST', '/orders', { key: newKey(), body: { productId: pid } })).status, 401);
      assert.strictEqual((await order(99999, pid, 1)).status, 401);
    });
    it('needs an Idempotency-Key', async () => {
      const u = addUser(); const pid = addProduct(1);
      const r = await call('POST', '/orders', { user: u, body: { productId: pid } });
      assert.strictEqual(r.status, 400);
      assert.strictEqual(r.json.error.code, 'IDEMPOTENCY_KEY_REQUIRED');
      assert.strictEqual(stockOf(pid), 1);
    });
    it('validates the body', async () => {
      const u = addUser(); const pid = addProduct(5);
      for (const body of [{}, { productId: 'x' }, { productId: pid, quantity: 0 }, { productId: pid, quantity: 1.5 }, { productId: pid, quantity: 99 }]) {
        assert.strictEqual((await call('POST', '/orders', { user: u, key: newKey(), body })).status, 400, JSON.stringify(body));
      }
      assert.strictEqual(stockOf(pid), 5);
    });
    it('unknown product -> 404', async () => {
      assert.strictEqual((await order(addUser(), 99999, 1)).status, 404);
    });
    it('creates the order, takes the stock and totals the price', async () => {
      const u = addUser(); const pid = addProduct(5, 2500);
      const r = await order(u, pid, 2);
      assert.strictEqual(r.status, 201);
      assert.strictEqual(r.json.quantity, 2);
      assert.strictEqual(r.json.totalCents, 5000);
      assert.match(r.res.headers.get('location'), /\/api\/orders\/\d+$/);
      assert.strictEqual(stockOf(pid), 3);
    });
    it('quantity is optional and defaults to 1', async () => {
      const u = addUser(); const pid = addProduct(2);
      const r = await call('POST', '/orders', { user: u, key: newKey(), body: { productId: pid } });
      assert.strictEqual(r.json.quantity, 1);
    });
    it('sold out -> 409 SOLD_OUT, stock stays at 0', async () => {
      const pid = addProduct(1);
      assert.strictEqual((await order(addUser(), pid, 1)).status, 201);
      const r = await order(addUser(), pid, 1);
      assert.strictEqual(r.status, 409);
      assert.strictEqual(r.json.error.code, 'SOLD_OUT');
      assert.strictEqual(stockOf(pid), 0);
    });
    it('asking for more than what is left -> 409 INSUFFICIENT_STOCK, nothing is taken', async () => {
      const pid = addProduct(2);
      const r = await order(addUser(), pid, 3);
      assert.strictEqual(r.status, 409);
      assert.strictEqual(r.json.error.code, 'INSUFFICIENT_STOCK');
      assert.match(r.json.error.message, /Only 2 units left/);
      assert.strictEqual(stockOf(pid), 2);
      assert.strictEqual(orderCount(pid), 0);
    });
  });

  describe('retries (idempotency)', () => {
    it('same key twice -> same order, stock taken once', async () => {
      const u = addUser(); const pid = addProduct(10); const key = newKey();
      const first = await order(u, pid, 2, key);
      const retry = await order(u, pid, 2, key);
      assert.strictEqual(first.status, 201);
      assert.strictEqual(retry.status, 200);
      assert.strictEqual(retry.res.headers.get('idempotent-replay'), 'true');
      assert.deepStrictEqual(retry.json, first.json);
      assert.strictEqual(stockOf(pid), 8);
      assert.strictEqual(orderCount(pid), 1);
    });
    it('a retry still works after the product sold out', async () => {
      const u = addUser(); const pid = addProduct(1); const key = newKey();
      const first = await order(u, pid, 1, key);
      const retry = await order(u, pid, 1, key); // stock is 0 now, but this is the same order
      assert.strictEqual(retry.status, 200);
      assert.strictEqual(retry.json.id, first.json.id);
    });
    it('same key with a different order -> 422', async () => {
      const u = addUser(); const pid = addProduct(10); const key = newKey();
      await order(u, pid, 1, key);
      const r = await order(u, pid, 3, key);
      assert.strictEqual(r.status, 422);
      assert.strictEqual(r.json.error.code, 'IDEMPOTENCY_KEY_REUSED');
      assert.strictEqual(stockOf(pid), 9);
    });
    it('two customers can use the same key', async () => {
      const pid = addProduct(10); const key = newKey();
      assert.strictEqual((await order(addUser(), pid, 1, key)).status, 201);
      assert.strictEqual((await order(addUser(), pid, 1, key)).status, 201);
      assert.strictEqual(orderCount(pid), 2);
    });
    it('a failed order (sold out) does not burn the key', async () => {
      const u = addUser(); const pid = addProduct(0); const key = newKey();
      assert.strictEqual((await order(u, pid, 1, key)).status, 409);
      db.prepare('UPDATE products SET stock = 1 WHERE id = ?').run(pid); // restock
      assert.strictEqual((await order(u, pid, 1, key)).status, 201);
    });
  });

  describe('viewing orders', () => {
    it('lists only my orders, newest first; others look like 404', async () => {
      const a = addUser('A'); const b = addUser('B'); const pid = addProduct(10);
      const o1 = (await order(a, pid, 1)).json;
      const o2 = (await order(a, pid, 2)).json;
      const ob = (await order(b, pid, 1)).json;
      const mine = (await call('GET', '/orders', { user: a })).json;
      assert.deepStrictEqual(mine.map((o) => o.id), [o2.id, o1.id]);
      assert.strictEqual((await call('GET', `/orders/${o1.id}`, { user: a })).json.productName, 'Item');
      assert.strictEqual((await call('GET', `/orders/${ob.id}`, { user: a })).status, 404);
      assert.strictEqual((await call('GET', '/orders')).status, 401);
    });
  });

  describe('concurrency', () => {
    it('200 customers, 5 units: exactly 5 orders, 195 "sold out", stock ends at 0', async () => {
      const pid = addProduct(5);
      const users = Array.from({ length: 200 }, () => addUser());
      const results = await Promise.all(users.map((u) => order(u, pid, 1)));
      assert.strictEqual(results.filter((r) => r.status === 201).length, 5);
      assert.strictEqual(results.filter((r) => r.status === 409 && r.json.error.code === 'SOLD_OUT').length, 195);
      assert.strictEqual(stockOf(pid), 0);
      assert.strictEqual(orderCount(pid), 5);
    });
    it('mixed quantities never oversell (10 units, 50 buyers wanting 3 each)', async () => {
      const pid = addProduct(10);
      const users = Array.from({ length: 50 }, () => addUser());
      const results = await Promise.all(users.map((u) => order(u, pid, 3)));
      assert.strictEqual(results.filter((r) => r.status === 201).length, 3);
      assert.strictEqual(unitsSold(pid), 9);
      assert.strictEqual(stockOf(pid), 1);
      assert.ok(results.every((r) => [201, 409].includes(r.status)));
    });
    it('50 simultaneous retries of the same request create ONE order', async () => {
      const u = addUser(); const pid = addProduct(10); const key = newKey();
      const results = await Promise.all(Array.from({ length: 50 }, () => order(u, pid, 1, key)));
      assert.strictEqual(results.filter((r) => r.status === 201).length, 1);
      assert.strictEqual(results.filter((r) => r.status === 200).length, 49);
      assert.strictEqual(new Set(results.map((r) => r.json.id)).size, 1);
      assert.strictEqual(orderCount(pid), 1);
      assert.strictEqual(stockOf(pid), 9);
    });
    it('the database itself refuses a negative stock', () => {
      const pid = addProduct(1);
      assert.throws(() => db.prepare('UPDATE products SET stock = stock - 2 WHERE id = ?').run(pid), /CHECK constraint/);
    });
  });

  it('unknown route and malformed JSON', async () => {
    assert.strictEqual((await call('GET', '/nope')).status, 404);
    const res = await fetch(base + '/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{ nope' });
    assert.strictEqual(res.status, 400);
  });
});
