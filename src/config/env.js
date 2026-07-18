// .env.local (written by the Clerk CLI) takes priority; .env fills the rest.
// dotenv does not overwrite already-set vars, so load .env.local first.
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const env = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/structunex",
  calcServiceUrl: process.env.CALC_SERVICE_URL || "http://localhost:8000",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  clerkSecretKey: process.env.CLERK_SECRET_KEY,
};

if (!env.clerkSecretKey) {
  console.warn(
    "[env] CLERK_SECRET_KEY is not set — auth will reject all requests. " +
      "Check .env.local (run `clerk init`)."
  );
}

module.exports = { env };
