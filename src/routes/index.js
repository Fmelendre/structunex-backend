const { Router } = require("express");
const projectRoutes = require("./projectRoutes");
const catalogMaterialRoutes = require("./catalogMaterialRoutes");
const catalogFrameSectionRoutes = require("./catalogFrameSectionRoutes");
const catalogAreaSectionRoutes = require("./catalogAreaSectionRoutes");
const aiscShapeRoutes = require("./aiscShapeRoutes");

const router = Router();

router.get("/health", (_req, res) => res.json({ status: "ok" }));
router.use("/projects", projectRoutes);
router.use("/materials", catalogMaterialRoutes);
router.use("/sections", catalogFrameSectionRoutes);
router.use("/area-sections", catalogAreaSectionRoutes);
router.use("/shapes", aiscShapeRoutes);

module.exports = router;
