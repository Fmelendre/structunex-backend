const { Router } = require("express");
const c = require("../controllers/supportController");
const { validate } = require("../middleware/validate");
const { support } = require("../schemas/projectSchema");

const router = Router({ mergeParams: true });

router.get("/", c.list);
router.post("/", validate(support), c.create);
router.get("/:id", c.getOne);
router.patch("/:id", validate(support.partial()), c.update);
router.delete("/:id", c.remove);

module.exports = router;
