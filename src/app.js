const express = require("express");
const cors = require("cors");
const { clerkMiddleware } = require("@clerk/express");
const { env } = require("./config/env");
const routes = require("./routes");
const webhookRoutes = require("./routes/webhookRoutes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

// CORS: permite el origen configurado y, en desarrollo, cualquier puerto de
// localhost (Vite suele cambiar de puerto). Peticiones sin origin (curl, health)
// también se permiten.
const localhostOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.clientOrigins.includes(origin) || localhostOrigin.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Webhooks must see the RAW body (Svix signature verification), so they are
// mounted BEFORE the global JSON parser and are not behind requireAuth.
app.use("/api/webhooks", webhookRoutes);

app.use(express.json({ limit: "2mb" }));

// Attaches Clerk session state to every request (does not block on its own).
app.use(clerkMiddleware());

app.use("/api", routes);

// 404 for unmatched routes
app.use((_req, res) => res.status(404).json({ error: "NotFound" }));

// Central error handler (must be last)
app.use(errorHandler);

module.exports = { app };
