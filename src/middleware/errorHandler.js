class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    // Optional structured payload (e.g. the calc-service culprit nodes/DOFs).
    if (details !== undefined) this.details = details;
  }
}

// Central error handler. Must be registered LAST in app.js.
function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    const body = { error: err.message };
    if (err.details !== undefined) body.details = err.details;
    return res.status(err.status).json(body);
  }
  console.error("[error]", err);
  return res.status(500).json({ error: "InternalServerError" });
}

// Wraps async controllers so thrown errors reach errorHandler.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { AppError, errorHandler, asyncHandler };
