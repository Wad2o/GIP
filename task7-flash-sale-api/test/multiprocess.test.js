// Starts 3 separate server processes on ONE database file and sends them orders at the same time.
// This is what a single process can't prove: correctness when requests really run in parallel.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flash-mp-'));
const DB_FILE = path.join(tmp, 'shared.db');
process.env.NODE_ENV = 'test';
process.env.DB_FILE = DB_FILE;
process.env.SEED = 'false';
const db = require('../src/db'); // creates the schema before the servers start

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'server.js')], {
      env: { ...process.env, PORT: '0', DB_FILE, SEED: 'false', NODE_ENV: 'test' },
    });
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      const m = out.match(/localhost:(\d+)/);
      if (m) resolve({ child, port: Number(m[1]) });
    });
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error('server exited early: ' + code)));
  });
}

describe('several server processes, one database', () => {
  let servers = [];
  before(async () => { servers = await Promise.all([startServer(), startServer(), startServer()]); });
  after(() => {
    servers.forEach((s) => { s.child.removeAllListeners('exit'); s.child.kill(); });
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('300 simultaneous orders over 3 processes, 5 units: exactly 5 orders', async () => {
    const pid = db.prepare("INSERT INTO products (name, price_cents, stock) VALUES ('Item', 1000, 5)").run().lastInsertRowid;
    const insertUser = db.prepare("INSERT INTO users (name) VALUES ('Customer')");
    const users = Array.from({ length: 300 }, () => insertUser.run().lastInsertRowid);

    const results = await Promise.all(users.map((u, i) =>
      fetch(`http://localhost:${servers[i % servers.length].port}/api/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-id': String(u), 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ productId: Number(pid), quantity: 1 }),
      }).then(async (r) => ({ status: r.status, body: await r.json() }))
    ));

    assert.strictEqual(results.filter((r) => r.status === 201).length, 5);
    assert.strictEqual(results.filter((r) => r.status === 409).length, 295);
    assert.ok(results.every((r) => r.status === 201 || r.status === 409), 'no 5xx errors');
    assert.strictEqual(db.prepare('SELECT stock FROM products WHERE id = ?').get(pid).stock, 0);
    assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM orders WHERE product_id = ?').get(pid).n, 5);
  });
});
