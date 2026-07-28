const { Router } = require("express");
const c = require("../controllers/analysisController");

const router = Router({ mergeParams: true });

// requireAuth + loadProject ya vienen heredados de projectRoutes, así que la propiedad
// del proyecto está comprobada antes de llegar aquí — incluido antes de firmar una URL.
router.get("/", c.get); // status + progreso + metadatos de la última ejecución
router.post("/", c.run); // lanza el solver (202; el progreso se consulta con GET)
router.delete("/", c.cancel); // cuelga un análisis en curso

router.get("/runs", c.listRuns); // historial de ejecuciones
router.get("/runs/:runId/urls", c.caseUrls); // URL prefirmadas de un caso (?case=clave)

module.exports = router;
