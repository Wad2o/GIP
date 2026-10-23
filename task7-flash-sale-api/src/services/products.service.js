const db = require('../db');
const AppError = require('../utils/AppError');

const toProduct = (r) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  priceCents: r.price_cents,
  stock: r.stock,
  available: r.stock > 0,
});

const all = db.prepare('SELECT * FROM products ORDER BY id');
const one = db.prepare('SELECT * FROM products WHERE id = ?');

const list = () => all.all().map(toProduct);

function get(id) {
  const row = one.get(id);
  if (!row) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  return toProduct(row);
}

const getStock = (id) => {
  const { stock } = get(id);
  return { productId: id, stock, available: stock > 0 };
};

module.exports = { list, get, getStock };
