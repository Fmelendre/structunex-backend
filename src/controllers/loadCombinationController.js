const { asyncHandler } = require("../middleware/errorHandler");
const { getCatalog } = require("../lib/loadCombinationsCatalog");

// Catálogo de combinaciones de diseño (read-only, in memory).
module.exports = {
  getCatalog: asyncHandler(async (_req, res) => {
    res.json(getCatalog());
  }),
};
