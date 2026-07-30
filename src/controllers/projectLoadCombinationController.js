const { asyncHandler } = require("../middleware/errorHandler");
const { ModelConfiguration } = require("../models");
const { generateDefaultCombos } = require("../services/loadComboService");

// Combos por defecto de UN proyecto. Lee los load patterns y los casos Response
// Spectrum del proyecto (fuente autoritativa) y genera las combinaciones con el
// término sísmico como marcador name-free. `req.projectId` lo pone loadProject.
module.exports = {
  defaults: asyncHandler(async (req, res) => {
    const projectId = req.projectId;
    const sets = Array.isArray(req.body && req.body.sets) ? req.body.sets : [];

    const config = await ModelConfiguration.findOne({ projectId })
      .select("loadPatterns responseSpectrumCases loadCombinations")
      .lean();

    const result = generateDefaultCombos({
      loadPatterns: (config && config.loadPatterns) || [],
      responseSpectrumCases: (config && config.responseSpectrumCases) || [],
      sets,
      // No colisionar con los combos que el proyecto ya tiene.
      reservedNames: ((config && config.loadCombinations) || []).map((c) => c.name),
    });

    res.json(result);
  }),
};
