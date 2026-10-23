const service = require('../services/items.service');

// An uploaded file wins over an imageUrl sent in the body.
const withImage = (req) => {
  const data = { ...req.validated.body };
  if (req.file) data.imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  return data;
};

exports.create = async (req, res) => {
  const item = await service.create(req.user.id, withImage(req));
  res.status(201).location(`/api/items/${item.id}`).json(item);
};
exports.list = async (req, res) => res.json(await service.list(req.validated.query));
exports.getOne = async (req, res) => res.json(await service.getDetails(req.validated.params.id));
exports.update = async (req, res) => res.json(await service.update(req.validated.params.id, req.user.id, withImage(req)));
exports.recover = async (req, res) => res.json(await service.markRecovered(req.validated.params.id, req.user.id));
