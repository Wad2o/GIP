const service = require('../services/users.service');

exports.me = async (req, res) => res.json(await service.getProfile(req.user.id));
