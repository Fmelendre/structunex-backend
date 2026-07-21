const { asyncHandler } = require("../middleware/errorHandler");
const analysisService = require("../services/analysisService");

// req.project / req.projectId are set by loadProject.
// Starts the solve and answers 202 straight away; the client then polls GET for
// progress. A model error still surfaces here as 4xx, because the payload is assembled
// before the job goes async.
const run = asyncHandler(async (req, res) => {
  // The request body carries the analysis conditions (activeDofs + load
  // patterns); the model geometry is read from the project's collections.
  const started = await analysisService.run(req.project, req.body?.analysisOptions);
  res.status(202).json(started);
});

const get = asyncHandler(async (req, res) => {
  res.json(await analysisService.get(req.projectId));
});

const cancel = asyncHandler(async (req, res) => {
  const cancelled = analysisService.cancel(req.projectId);
  res.json({ cancelled });
});

module.exports = { run, get, cancel };
