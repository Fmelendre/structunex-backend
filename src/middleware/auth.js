const { getAuth } = require("@clerk/express");
const { AppError } = require("./errorHandler");

// Blocks unauthenticated requests and exposes the Clerk user id as req.userId.
// Requires clerkMiddleware() to run earlier (registered in app.js).
function requireAuth(req, _res, next) {
  const { isAuthenticated, userId } = getAuth(req);
  if (!isAuthenticated) return next(new AppError(401, "Unauthorized"));
  req.userId = userId; // used as ownerId from here on
  next();
}

module.exports = { requireAuth };
