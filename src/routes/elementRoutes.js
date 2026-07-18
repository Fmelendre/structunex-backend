const { Router } = require("express");
const c = require("../controllers/elementController");
const { validate } = require("../middleware/validate");
const { element } = require("../schemas/projectSchema");

const router = Router({ mergeParams: true });

router.get("/", c.list);
router.post("/", validate(element), c.create);
router.get("/:id", c.getOne);
router.patch("/:id", validate(element.partial()), c.update);
router.delete("/:id", c.remove);

module.exports = router;
