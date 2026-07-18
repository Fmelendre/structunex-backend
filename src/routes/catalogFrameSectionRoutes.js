const { Router } = require("express");
const c = require("../controllers/catalogFrameSectionController");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const {
  createCatalogFrameSection,
  updateCatalogFrameSection,
} = require("../schemas/catalogFrameSectionSchema");

const router = Router();

// User-owned catalog: auth required, but NOT project-scoped (no loadProject).
router.use(requireAuth);

router.get("/", c.list);
router.post("/", validate(createCatalogFrameSection), c.create);
router.get("/:id", c.getOne);
router.patch("/:id", validate(updateCatalogFrameSection), c.update);
router.delete("/:id", c.remove);

module.exports = router;
