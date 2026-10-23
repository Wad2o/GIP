// In-memory user store (data resets on restart). Swap this file for a database to persist users.
const byEmail = new Map();
const byId = new Map();
let nextId = 1;

module.exports = {
  findByEmail: (email) => byEmail.get(email),
  findById: (id) => byId.get(id),
  create(data) {
    const user = { id: nextId++, ...data, createdAt: new Date().toISOString() };
    byEmail.set(user.email, user);
    byId.set(user.id, user);
    return user;
  },
  clear() { byEmail.clear(); byId.clear(); nextId = 1; },
};
