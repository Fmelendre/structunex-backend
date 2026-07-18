const { Router } = require("express");
const c = require("../controllers/catalogMaterialController");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const {
  createCatalogMaterial,
  updateCatalogMaterial,
} = require("../schemas/catalogMaterialSchema");

const router = Router();

// User-owned catalog: auth required, but NOT project-scoped (no loadProject).
router.use(requireAuth);

router.get("/", c.list);
router.post("/", validate(createCatalogMaterial), c.create);
router.get("/:id", c.getOne);
router.patch("/:id", validate(updateCatalogMaterial), c.update);
router.delete("/:id", c.remove);

module.exports = router;
