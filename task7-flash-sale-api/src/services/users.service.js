const db = require('../db');

const insert = db.prepare('INSERT INTO users (name) VALUES (?)');
const byId = db.prepare('SELECT id, name, created_at AS createdAt FROM users WHERE id = ?');

const create = (name) => byId.get(insert.run(name).lastInsertRowid);
const findById = (id) => byId.get(id);

module.exports = { create, findById };
