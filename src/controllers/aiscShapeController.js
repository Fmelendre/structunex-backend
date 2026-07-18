const { asyncHandler, AppError } = require("../middleware/errorHandler");
const { searchShapes, getShape, families } = require("../lib/aiscShapes");

// AISC system catalog (read-only, in memory). validate.js only checks body, so
// query params are read directly here.
module.exports = {
  search: asyncHandler(async (req, res) => {
    const { q, type, page, limit } = req.query;
    res.json(searchShapes({ q, type, page, limit }));
  }),

  families: asyncHandler(async (_req, res) => {
    res.json(families());
  }),

  getOne: asyncHandler(async (req, res) => {
    const shape = getShape(req.params.label);
    if (!shape) throw new AppError(404, "Shape not found");
    res.json(shape);
  }),
};
