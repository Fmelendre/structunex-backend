const { Router } = require("express");
const c = require("../controllers/nodeController");
const { validate } = require("../middleware/validate");
const { node } = require("../schemas/projectSchema");

const router = Router({ mergeParams: true });

router.get("/", c.list);
router.post("/", validate(node), c.create);
router.get("/:id", c.getOne);
router.patch("/:id", validate(node.partial()), c.update);
router.delete("/:id", c.remove);

module.exports = router;
