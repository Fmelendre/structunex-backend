const { asyncHandler } = require("../middleware/errorHandler");
const analysisService = require("../services/analysisService");

// req.project / req.projectId are set by loadProject.
const run = asyncHandler(async (req, res) => {
  // The request body carries the analysis conditions (activeDofs + load
  // patterns); the model geometry is read from the project's collections.
  const result = await analysisService.run(req.project, req.body?.analysisOptions);
  res.status(201).json(result);
});

const get = asyncHandler(async (req, res) => {
  res.json(await analysisService.get(req.projectId));
});

module.exports = { run, get };
