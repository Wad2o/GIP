const service = require('../services/auth.service');
const { signupInput, loginInput } = require('../middleware/validate');

exports.signup = async (req, res) => res.status(201).json(await service.signup(signupInput(req.body)));
exports.login = async (req, res) => res.json(await service.login(loginInput(req.body)));
exports.me = (req, res) => res.json({ user: req.user });
exports.verify = (req, res) => {
  const { sub, email, iat, exp } = req.tokenPayload;
  res.json({ valid: true, payload: { sub, email, iat, exp } });
};
