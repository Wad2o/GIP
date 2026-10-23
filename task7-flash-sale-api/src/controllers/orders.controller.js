const service = require('../services/orders.service');
const { parseIdParam, parseIdempotencyKey, parseOrderInput } = require('../validators');

exports.create = (req, res) => {
  const key = parseIdempotencyKey(req.get('Idempotency-Key'));
  const input = parseOrderInput(req.body);
  const { order, replayed } = service.place(req.user.id, input, key);
  if (replayed) res.set('Idempotent-Replay', 'true'); // tells the client "this is your earlier order"
  res.status(replayed ? 200 : 201).location(`/api/orders/${order.id}`).json(order);
};

exports.list = (req, res) => res.json(service.listForUser(req.user.id));
exports.getOne = (req, res) => res.json(service.getForUser(req.user.id, parseIdParam(req.params.id, 'order')));
