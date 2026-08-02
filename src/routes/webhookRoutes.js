const express = require("express");
const { handleClerkWebhook } = require("../controllers/webhookController");

const router = express.Router();

// Raw body is required for Svix signature verification, so parse it here per-route
// instead of relying on the global express.json() (which is mounted after this).
router.post(
  "/clerk",
  express.raw({ type: "application/json" }),
  handleClerkWebhook
);

module.exports = router;
