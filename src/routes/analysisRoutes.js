const { Router } = require("express");
const c = require("../controllers/analysisController");

const router = Router({ mergeParams: true });

router.get("/", c.get); // current status + last result
router.post("/", c.run); // run the solver

module.exports = router;
