const { asyncHandler } = require("../middleware/errorHandler");
const service = require("../services/modelService");

// Whole-model read/reconcile for a project. req.projectId is set by
// loadProject (ownership already verified upstream).
module.exports = {
  get: asyncHandler(async (req, res) => {
    res.json(await service.getModel(req.projectId));
  }),

  save: asyncHandler(async (req, res) => {
    res.json(await service.saveModel(req.projectId, req.body));
  }),
};
