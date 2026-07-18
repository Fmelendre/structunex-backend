const { Router } = require("express");
const c = require("../controllers/catalogAreaSectionController");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const {
  createCatalogAreaSection,
  updateCatalogAreaSection,
} = require("../schemas/catalogAreaSectionSchema");

const router = Router();

// User-owned catalog: auth required, but NOT project-scoped (no loadProject).
router.use(requireAuth);

router.get("/", c.list);
router.post("/", validate(createCatalogAreaSection), c.create);
router.get("/:id", c.getOne);
router.patch("/:id", validate(updateCatalogAreaSection), c.update);
router.delete("/:id", c.remove);

module.exports = router;
