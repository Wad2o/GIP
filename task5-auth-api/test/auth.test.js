const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const jwt = require('jsonwebtoken');
const app = require('../src/app');
const store = require('../src/store');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('Auth API', () => {
  let server, base, token, user;

  const call = async (method, url, { body, token: t, raw } = {}) => {
    const headers = {};
    if (t) headers.authorization = `Bearer ${t}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(base + url, { method, headers, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    return { status: res.status, json: await res.json(), res };
  };

  before(() => { store.clear(); server = app.listen(0); base = `http://localhost:${server.address().port}/api`; });
  after(() => server.close());

  describe('signup', () => {
    it('lists every validation problem', async () => {
      const r = await call('POST', '/auth/signup', { body: { name: 'A', email: 'nope', password: 'short' } });
      assert.strictEqual(r.status, 400);
      assert.deepStrictEqual(r.json.error.details.map((d) => d.field).sort(), ['email', 'name', 'password']);
    });
    it('creates the account, returns a token, never the password or hash', async () => {
      const r = await call('POST', '/auth/signup', { body: { name: 'Alice', email: ' Alice@Example.com ', password: 'correct horse' } });
      assert.strictEqual(r.status, 201);
      assert.strictEqual(r.json.user.email, 'alice@example.com');
      assert.ok(r.json.token);
      assert.ok(!JSON.stringify(r.json).match(/password|\$2[aby]\$/i));
      ({ user, token } = r.json);
    });
    it('stores a bcrypt hash, not the password', () => {
      const stored = store.findByEmail('alice@example.com');
      assert.notStrictEqual(stored.passwordHash, 'correct horse');
      assert.match(stored.passwordHash, /^\$2[aby]\$/);
    });
    it('duplicate email (any letter case) -> 409', async () => {
      const r = await call('POST', '/auth/signup', { body: { name: 'Alice 2', email: 'ALICE@example.com', password: 'another pass' } });
      assert.strictEqual(r.status, 409);
    });
    it('malformed JSON -> 400', async () => {
      const r = await call('POST', '/auth/signup', { raw: '{ nope', body: {} });
      assert.strictEqual(r.status, 400);
    });
  });

  describe('login', () => {
    it('returns a JWT with the right subject and expiry', async () => {
      const r = await call('POST', '/auth/login', { body: { email: 'alice@example.com', password: 'correct horse' } });
      assert.strictEqual(r.status, 200);
      const payload = jwt.verify(r.json.token, 'test-secret', { algorithms: ['HS256'] });
      assert.strictEqual(payload.sub, String(user.id));
      assert.ok(payload.exp > payload.iat);
    });
    it('wrong password and unknown email give the same 401', async () => {
      const a = await call('POST', '/auth/login', { body: { email: 'alice@example.com', password: 'wrong password' } });
      const b = await call('POST', '/auth/login', { body: { email: 'ghost@example.com', password: 'whatever123' } });
      assert.strictEqual(a.status, 401);
      assert.strictEqual(b.status, 401);
      assert.deepStrictEqual(a.json, b.json);
    });
    it('missing fields -> 400', async () => {
      assert.strictEqual((await call('POST', '/auth/login', { body: {} })).status, 400);
    });
  });

  describe('token verification', () => {
    it('GET /auth/me works with a valid token', async () => {
      const r = await call('GET', '/auth/me', { token });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.user.email, 'alice@example.com');
    });
    it('GET /auth/verify returns the token payload', async () => {
      const r = await call('GET', '/auth/verify', { token });
      assert.strictEqual(r.json.valid, true);
      assert.strictEqual(r.json.payload.sub, String(user.id));
    });
    it('no token / wrong scheme -> 401 with WWW-Authenticate', async () => {
      const r = await call('GET', '/auth/me');
      assert.strictEqual(r.status, 401);
      assert.strictEqual(r.res.headers.get('www-authenticate'), 'Bearer');
      const res = await fetch(base + '/auth/me', { headers: { authorization: `Basic ${token}` } });
      assert.strictEqual(res.status, 401);
    });
    it('garbage, tampered and wrongly signed tokens -> 401', async () => {
      assert.strictEqual((await call('GET', '/auth/me', { token: 'garbage' })).status, 401);
      const [h, p, s] = token.split('.');
      const forgedPayload = b64({ ...JSON.parse(Buffer.from(p, 'base64url')), sub: '999' });
      assert.strictEqual((await call('GET', '/auth/me', { token: `${h}.${forgedPayload}.${s}` })).status, 401);
      const other = jwt.sign({}, 'another-secret', { subject: String(user.id) });
      assert.strictEqual((await call('GET', '/auth/me', { token: other })).status, 401);
    });
    it('expired token -> 401 "Token expired"', async () => {
      const expired = jwt.sign({}, 'test-secret', { subject: String(user.id), expiresIn: -10 });
      const r = await call('GET', '/auth/me', { token: expired });
      assert.strictEqual(r.status, 401);
      assert.strictEqual(r.json.error.message, 'Token expired');
    });
    it('"alg: none" token is rejected', async () => {
      const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: String(user.id) })}.`;
      assert.strictEqual((await call('GET', '/auth/me', { token: none })).status, 401);
    });
    it('a valid token for a user that no longer exists -> 401', async () => {
      const ghost = jwt.sign({}, 'test-secret', { subject: '4242', expiresIn: '1h' });
      assert.strictEqual((await call('GET', '/auth/me', { token: ghost })).status, 401);
    });
  });

  it('health check and unknown route', async () => {
    assert.strictEqual((await call('GET', '/health')).json.status, 'ok');
    assert.strictEqual((await call('GET', '/nope')).status, 404);
  });
});
