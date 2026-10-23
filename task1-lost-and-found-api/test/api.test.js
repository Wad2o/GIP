const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Point the app at a throwaway database and upload folder BEFORE loading it.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'laf-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = `file:${path.join(tmp, 'test.db')}`;
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');

// Build the schema from the real migration files.
const Database = require('better-sqlite3');
const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
const sqlite = new Database(path.join(tmp, 'test.db'));
for (const dir of fs.readdirSync(migrationsDir).filter((d) => fs.statSync(path.join(migrationsDir, d)).isDirectory()).sort()) {
  sqlite.exec(fs.readFileSync(path.join(migrationsDir, dir, 'migration.sql'), 'utf8'));
}
sqlite.close();

const app = require('../src/app');
const prisma = require('../src/config/prisma');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

describe('Lost & Found API', () => {
  let server, base, alice, bob, wallet, umbrella, keys, phone;

  const call = async (method, url, { body, token, form } = {}) => {
    const headers = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(base + url, { method, headers, body: form ?? (body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined) });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, json, res };
  };

  before(() => {
    server = app.listen(0);
    base = `http://localhost:${server.address().port}`;
  });
  after(async () => {
    server.close();
    await prisma.$disconnect();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  describe('system', () => {
    it('health check', async () => assert.strictEqual((await call('GET', '/api/health')).json.status, 'ok'));
    it('serves the API docs', async () => assert.strictEqual((await call('GET', '/api/docs/')).status, 200));
    it('unknown route -> 404 JSON', async () => {
      const r = await call('GET', '/api/nope');
      assert.strictEqual(r.status, 404);
      assert.strictEqual(r.json.error.status, 404);
    });
    it('malformed JSON -> 400', async () => {
      const r = await call('POST', '/api/auth/login', { body: '{ not json' });
      assert.strictEqual(r.status, 400);
      assert.match(r.json.error.message, /Malformed/);
    });
  });

  describe('auth', () => {
    it('register validates input with field-level details', async () => {
      const r = await call('POST', '/api/auth/register', { body: { name: 'A', phone: '12', password: 'short' } });
      assert.strictEqual(r.status, 400);
      assert.deepStrictEqual(r.json.error.details.map((d) => d.field).sort(), ['name', 'password', 'phone']);
    });

    it('registers users and never returns the password', async () => {
      const a = await call('POST', '/api/auth/register', { body: { name: 'Alice', phone: '0550000001', password: 'password123' } });
      assert.strictEqual(a.status, 201);
      assert.ok(a.json.token);
      assert.strictEqual(a.json.user.password, undefined);
      alice = { ...a.json.user, token: a.json.token };
      const b = await call('POST', '/api/auth/register', { body: { name: 'Bob', phone: '0550000002', password: 'password123' } });
      bob = { ...b.json.user, token: b.json.token };
    });

    it('duplicate phone -> 409', async () => {
      const r = await call('POST', '/api/auth/register', { body: { name: 'Alice 2', phone: '0550000001', password: 'password123' } });
      assert.strictEqual(r.status, 409);
    });

    it('login works, wrong password and unknown phone -> 401', async () => {
      const ok = await call('POST', '/api/auth/login', { body: { phone: '0550000001', password: 'password123' } });
      assert.strictEqual(ok.status, 200);
      assert.ok(ok.json.token);
      assert.strictEqual((await call('POST', '/api/auth/login', { body: { phone: '0550000001', password: 'wrongpass1' } })).status, 401);
      assert.strictEqual((await call('POST', '/api/auth/login', { body: { phone: '0599999999', password: 'password123' } })).status, 401);
    });

    it('protected routes reject missing and bad tokens', async () => {
      assert.strictEqual((await call('POST', '/api/items', { body: {} })).status, 401);
      assert.strictEqual((await call('GET', '/api/users/me', { token: 'garbage' })).status, 401);
    });
  });

  describe('create items', () => {
    it('validation errors list every problem', async () => {
      const r = await call('POST', '/api/items', { token: alice.token, body: { type: 'maybe', date: 'nope' } });
      assert.strictEqual(r.status, 400);
      const fields = r.json.error.details.map((d) => d.field);
      for (const f of ['itemName', 'type', 'place', 'date']) assert.ok(fields.includes(f), `missing detail for ${f}`);
    });

    it('rejects future dates', async () => {
      const r = await call('POST', '/api/items', { token: alice.token, body: { itemName: 'x', type: 'LOST', place: 'y', date: '2099-01-01' } });
      assert.strictEqual(r.status, 400);
    });

    it('creates lost and found reports (type is case-insensitive)', async () => {
      const w = await call('POST', '/api/items', { token: alice.token, body: { itemName: 'Black wallet', type: 'lost', place: 'Algiers Central Station', date: '2026-10-10', description: 'Leather, has ID cards' } });
      assert.strictEqual(w.status, 201);
      assert.strictEqual(w.json.type, 'LOST');
      assert.strictEqual(w.json.status, 'NOT_RECOVERED');
      assert.strictEqual(w.json.userId, alice.id);
      assert.match(w.res.headers.get('location'), /\/api\/items\/\d+$/);
      wallet = w.json;

      umbrella = (await call('POST', '/api/items', { token: bob.token, body: { itemName: 'Blue umbrella', type: 'FOUND', place: 'Bab Ezzouar', date: '2026-10-12T15:00:00Z' } })).json;
    });

    it('accepts an image upload and serves it', async () => {
      const form = new FormData();
      form.append('itemName', 'House keys');
      form.append('type', 'FOUND');
      form.append('place', 'Oran');
      form.append('date', '2026-10-15');
      form.append('image', new Blob([PNG], { type: 'image/png' }), 'keys.png');
      const r = await call('POST', '/api/items', { token: alice.token, form });
      assert.strictEqual(r.status, 201);
      assert.match(r.json.imageUrl, /\/uploads\/.+\.png$/);
      keys = r.json;
      const img = await fetch(r.json.imageUrl);
      assert.strictEqual(img.status, 200);
      assert.strictEqual(img.headers.get('content-type'), 'image/png');
    });

    it('rejects non-image uploads and leaves no file behind', async () => {
      const before = fs.readdirSync(process.env.UPLOAD_DIR).length;
      const form = new FormData();
      form.append('itemName', 'x'); form.append('type', 'LOST'); form.append('place', 'y'); form.append('date', '2026-10-01');
      form.append('image', new Blob(['hello'], { type: 'text/plain' }), 'a.txt');
      const r = await call('POST', '/api/items', { token: alice.token, form });
      assert.strictEqual(r.status, 400);
      assert.strictEqual(fs.readdirSync(process.env.UPLOAD_DIR).length, before);
    });

    it('removes an uploaded image when validation fails', async () => {
      const before = fs.readdirSync(process.env.UPLOAD_DIR).length;
      const form = new FormData();
      form.append('itemName', 'x'); // missing type, place, date
      form.append('image', new Blob([PNG], { type: 'image/png' }), 'k.png');
      const r = await call('POST', '/api/items', { token: alice.token, form });
      assert.strictEqual(r.status, 400);
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.strictEqual(fs.readdirSync(process.env.UPLOAD_DIR).length, before);
    });

    it('creates one more item for pagination checks', async () => {
      phone = (await call('POST', '/api/items', { token: bob.token, body: { itemName: 'Silver phone', type: 'LOST', place: 'Hydra', date: '2026-10-16' } })).json;
      assert.ok(phone.id);
    });
  });

  describe('search and filter', () => {
    const names = (r) => r.json.items.map((i) => i.itemName);

    it('lists everything, newest first, with pagination meta', async () => {
      const r = await call('GET', '/api/items');
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(names(r), ['Silver phone', 'House keys', 'Blue umbrella', 'Black wallet']);
      assert.deepStrictEqual(r.json.meta, { page: 1, limit: 20, total: 4, totalPages: 1 });
    });
    it('filters by type', async () => assert.deepStrictEqual(names(await call('GET', '/api/items?type=FOUND')).sort(), ['Blue umbrella', 'House keys']));
    it('type filter is case-insensitive', async () => assert.strictEqual((await call('GET', '/api/items?type=lost')).json.items.length, 2));
    it('searches text case-insensitively (q)', async () => assert.deepStrictEqual(names(await call('GET', '/api/items?q=WALLET')), ['Black wallet']));
    it('q also searches description and place', async () => {
      assert.deepStrictEqual(names(await call('GET', '/api/items?q=id%20cards')), ['Black wallet']);
      assert.deepStrictEqual(names(await call('GET', '/api/items?q=hydra')), ['Silver phone']);
    });
    it('filters by place', async () => assert.deepStrictEqual(names(await call('GET', '/api/items?place=oran')), ['House keys']));
    it('filters by date range; "to" includes the whole day', async () => {
      assert.deepStrictEqual(names(await call('GET', '/api/items?from=2026-10-14')), ['Silver phone', 'House keys']);
      assert.deepStrictEqual(names(await call('GET', '/api/items?to=2026-10-12')), ['Blue umbrella', 'Black wallet']);
    });
    it('filters by user', async () => assert.strictEqual((await call('GET', `/api/items?userId=${bob.id}`)).json.items.length, 2));
    it('combines filters', async () => assert.deepStrictEqual(names(await call('GET', '/api/items?type=LOST&userId=' + bob.id)), ['Silver phone']));
    it('paginates', async () => {
      const p2 = await call('GET', '/api/items?limit=3&page=2');
      assert.deepStrictEqual(names(p2), ['Black wallet']);
      assert.deepStrictEqual(p2.json.meta, { page: 2, limit: 3, total: 4, totalPages: 2 });
    });
    it('rejects invalid filters with 400', async () => {
      for (const qs of ['type=NOPE', 'status=NOPE', 'from=banana', 'userId=abc', 'limit=1000', 'page=0', 'from=2026-10-20&to=2026-10-01']) {
        assert.strictEqual((await call('GET', `/api/items?${qs}`)).status, 400, qs);
      }
    });
  });

  describe('item details', () => {
    it('returns the item with who reported it', async () => {
      const r = await call('GET', `/api/items/${wallet.id}`);
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(r.json.reportedBy, { id: alice.id, name: 'Alice', phone: '0550000001' });
      assert.strictEqual(r.json.user, undefined);
    });
    it('unknown id -> 404, malformed id -> 400', async () => {
      assert.strictEqual((await call('GET', '/api/items/9999')).status, 404);
      assert.strictEqual((await call('GET', '/api/items/abc')).status, 400);
    });
  });

  describe('update own report', () => {
    it('someone else cannot update it (403)', async () => {
      assert.strictEqual((await call('PATCH', `/api/items/${wallet.id}`, { token: bob.token, body: { place: 'x' } })).status, 403);
    });
    it('updates only provided fields; null and empty are ignored', async () => {
      const r = await call('PATCH', `/api/items/${wallet.id}`, { token: alice.token, body: { place: 'Hydra', description: null, itemName: '' } });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.place, 'Hydra');
      assert.strictEqual(r.json.description, 'Leather, has ID cards');
      assert.strictEqual(r.json.itemName, 'Black wallet');
    });
    it('can change type and date, and re-validates them', async () => {
      const ok = await call('PATCH', `/api/items/${wallet.id}`, { token: alice.token, body: { type: 'found', date: '2026-10-11' } });
      assert.strictEqual(ok.json.type, 'FOUND');
      assert.strictEqual((await call('PATCH', `/api/items/${wallet.id}`, { token: alice.token, body: { type: 'nope' } })).status, 400);
      await call('PATCH', `/api/items/${wallet.id}`, { token: alice.token, body: { type: 'LOST' } });
    });
    it('nothing to update -> 400', async () => {
      assert.strictEqual((await call('PATCH', `/api/items/${wallet.id}`, { token: alice.token, body: {} })).status, 400);
    });
    it('can replace the image with an upload', async () => {
      const form = new FormData();
      form.append('image', new Blob([PNG], { type: 'image/png' }), 'new.png');
      const r = await call('PATCH', `/api/items/${keys.id}`, { token: alice.token, form });
      assert.strictEqual(r.status, 200);
      assert.notStrictEqual(r.json.imageUrl, keys.imageUrl);
    });
    it('unknown item -> 404', async () => {
      assert.strictEqual((await call('PATCH', '/api/items/9999', { token: alice.token, body: { place: 'x' } })).status, 404);
    });
  });

  describe('mark as recovered', () => {
    it('only the owner can (403), item must exist (404)', async () => {
      assert.strictEqual((await call('PATCH', `/api/items/${wallet.id}/recover`, { token: bob.token })).status, 403);
      assert.strictEqual((await call('PATCH', '/api/items/9999/recover', { token: alice.token })).status, 404);
    });
    it('marks it recovered, then 409 the second time', async () => {
      const r = await call('PATCH', `/api/items/${wallet.id}/recover`, { token: alice.token });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.status, 'RECOVERED');
      assert.strictEqual((await call('PATCH', `/api/items/${wallet.id}/recover`, { token: alice.token })).status, 409);
    });
    it('can be filtered by status', async () => {
      assert.deepStrictEqual((await call('GET', '/api/items?status=RECOVERED')).json.items.map((i) => i.itemName), ['Black wallet']);
      assert.strictEqual((await call('GET', '/api/items?status=NOT_RECOVERED')).json.items.length, 3);
    });
  });

  describe('profile', () => {
    it('GET /users/me returns the user with their reports and no password', async () => {
      const r = await call('GET', '/api/users/me', { token: alice.token });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.name, 'Alice');
      assert.strictEqual(r.json.password, undefined);
      assert.deepStrictEqual(r.json.reports.map((x) => x.itemName).sort(), ['Black wallet', 'House keys']);
    });
  });
});
