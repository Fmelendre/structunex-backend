const { asyncHandler } = require("../middleware/errorHandler");

// Wraps a child service (from services/crudFactory) into Express handlers.
// req.projectId is set by loadProject; req.params.id is the child's Mongo _id.
function makeChildController(service) {
  return {
    list: asyncHandler(async (req, res) => {
      res.json(await service.list(req.projectId));
    }),

    create: asyncHandler(async (req, res) => {
      res.status(201).json(await service.create(req.projectId, req.body));
    }),

    getOne: asyncHandler(async (req, res) => {
      res.json(await service.getOne(req.projectId, req.params.id));
    }),

    update: asyncHandler(async (req, res) => {
      res.json(await service.update(req.projectId, req.params.id, req.body));
    }),

    remove: asyncHandler(async (req, res) => {
      res.json(await service.remove(req.projectId, req.params.id));
    }),
  };
}

module.exports = { makeChildController };
