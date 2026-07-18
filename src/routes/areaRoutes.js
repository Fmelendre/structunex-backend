const { Router } = require("express");
const c = require("../controllers/areaController");
const { validate } = require("../middleware/validate");
const { area } = require("../schemas/projectSchema");

const router = Router({ mergeParams: true });

router.get("/", c.list);
router.post("/", validate(area), c.create);
router.get("/:id", c.getOne);
router.patch("/:id", validate(area.partial()), c.update);
router.delete("/:id", c.remove);

module.exports = router;
