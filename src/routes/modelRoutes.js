const { Router } = require("express");
const c = require("../controllers/modelController");
const { validate } = require("../middleware/validate");
const { modelSchema } = require("../schemas/modelSchema");

const router = Router({ mergeParams: true });

// Whole-model endpoints. GET hydrates the viewer; PUT reconciles (replace by
// collection) for incremental autosave.
router.get("/", c.get);
router.put("/", validate(modelSchema), c.save);

module.exports = router;
