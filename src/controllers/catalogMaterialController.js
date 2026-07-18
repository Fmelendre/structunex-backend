const { asyncHandler } = require("../middleware/errorHandler");
const service = require("../services/catalogMaterialService");

// Material catalog handlers. req.userId is set by requireAuth and used as the
// owner scope.
module.exports = {
  list: asyncHandler(async (req, res) => {
    res.json(await service.list(req.userId));
  }),

  create: asyncHandler(async (req, res) => {
    res.status(201).json(await service.create(req.userId, req.body));
  }),

  getOne: asyncHandler(async (req, res) => {
    res.json(await service.getOne(req.userId, req.params.id));
  }),

  update: asyncHandler(async (req, res) => {
    res.json(await service.update(req.userId, req.params.id, req.body));
  }),

  remove: asyncHandler(async (req, res) => {
    res.json(await service.remove(req.userId, req.params.id));
  }),
};
