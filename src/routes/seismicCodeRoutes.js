const { Router } = require("express");
const c = require("../controllers/seismicCodeController");
const { requireAuth } = require("../middleware/auth");

const router = Router();

// System catalog: any authenticated user can read. Served from memory.
router.use(requireAuth);

router.get("/", c.list);
router.get("/:code", c.getOne);

module.exports = router;
