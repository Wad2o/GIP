// Error with an HTTP status and a machine-readable code (e.g. SOLD_OUT).
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = AppError;
