const { asyncHandler, AppError } = require("../middleware/errorHandler");
const { getCode, listCodes } = require("../lib/seismicCodeCatalog");

// Normas sísmicas del sistema (read-only, in memory).
module.exports = {
  list: asyncHandler(async (_req, res) => {
    res.json(listCodes());
  }),

  getOne: asyncHandler(async (req, res) => {
    const code = getCode(req.params.code);
    if (!code) throw new AppError(404, "Seismic code not found");
    res.json(code);
  }),
};
