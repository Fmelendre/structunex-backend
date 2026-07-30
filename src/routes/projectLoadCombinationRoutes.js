const { Router } = require("express");
const c = require("../controllers/projectLoadCombinationController");

// Montado bajo /projects/:projectId/load-combinations (tras loadProject).
const router = Router({ mergeParams: true });

// Genera los Default Design Combos del proyecto (término sísmico como marcador).
router.post("/defaults", c.defaults);

module.exports = router;
