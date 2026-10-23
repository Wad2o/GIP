const service = require('../services/products.service');
const { parseIdParam } = require('../validators');

exports.list = (_req, res) => res.json(service.list());
exports.getOne = (req, res) => res.json(service.get(parseIdParam(req.params.id, 'product')));
exports.stock = (req, res) => res.json(service.getStock(parseIdParam(req.params.id, 'product')));
