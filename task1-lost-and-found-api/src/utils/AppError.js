// Error with an HTTP status. Thrown anywhere; the error handler turns it into a response.
class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }
}

module.exports = AppError;
