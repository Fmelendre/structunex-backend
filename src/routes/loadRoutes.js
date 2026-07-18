const { Router } = require("express");
const c = require("../controllers/loadController");
const { validate } = require("../middleware/validate");
const { load } = require("../schemas/projectSchema");

const router = Router({ mergeParams: true });

router.get("/", c.list);
router.post("/", validate(load), c.create);
router.get("/:id", c.getOne);
router.patch("/:id", validate(load.partial()), c.update);
router.delete("/:id", c.remove);

module.exports = router;
