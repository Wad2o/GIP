const service = require('../services/auth.service');

exports.register = async (req, res) => res.status(201).json(await service.register(req.validated.body));
exports.login = async (req, res) => res.json(await service.login(req.validated.body));
