const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

// Accepts one optional image in the "image" form field (max 5 MB, jpeg/png/webp/gif).
module.exports = multer({
  storage: multer.diskStorage({
    destination: env.UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + EXTENSIONS[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    EXTENSIONS[file.mimetype] ? cb(null, true) : cb(new AppError(400, 'Only jpeg, png, webp or gif images are allowed')),
});
