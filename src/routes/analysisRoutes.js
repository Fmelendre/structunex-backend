const { Router } = require("express");
const c = require("../controllers/analysisController");

const router = Router({ mergeParams: true });

router.get("/", c.get); // current status + live progress + last result
router.post("/", c.run); // start the solver (202; poll GET for progress)
router.delete("/", c.cancel); // hang up on a running analysis

module.exports = router;
