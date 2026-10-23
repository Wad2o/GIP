// Simulates a flash sale against a running server:  npm start  (one terminal), npm run demo  (another)
// Usage: node scripts/flash-sale-demo.js [buyers=300] [productId=1]
const BASE = process.env.BASE_URL || 'http://localhost:3000/api';
const buyers = Number(process.argv[2]) || 300;
const productId = Number(process.argv[3]) || 1;

const json = (path, opts) => fetch(BASE + path, opts).then(async (r) => ({ status: r.status, body: await r.json() }));

(async () => {
  const before = (await json(`/products/${productId}`)).body;
  console.log(`${before.name}: ${before.stock} in stock, ${buyers} customers buying at the same time...`);

  const users = await Promise.all(
    Array.from({ length: buyers }, (_, i) => json('/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: `Buyer ${i + 1}` }) }))
  );

  const started = Date.now();
  const results = await Promise.all(
    users.map((u) => json('/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': String(u.body.id), 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ productId, quantity: 1 }),
    }))
  );
  const ms = Date.now() - started;

  const count = (pred) => results.filter(pred).length;
  const after = (await json(`/products/${productId}`)).body;
  console.log(`orders created : ${count((r) => r.status === 201)}`);
  console.log(`sold out (409) : ${count((r) => r.status === 409)}`);
  console.log(`other          : ${count((r) => r.status !== 201 && r.status !== 409)}`);
  console.log(`stock left     : ${after.stock}   (${ms} ms)`);
})();
