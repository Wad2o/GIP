const service = require('../services/users.service');
const { parseUserInput } = require('../validators');

exports.create = (req, res) => res.status(201).json(service.create(parseUserInput(req.body).name));
