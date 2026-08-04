const { asyncHandler } = require("../middleware/errorHandler");
const designService = require("../services/designService");

// req.project / req.projectId los pone loadProject.
//
// Lanza la comprobación y responde 202; el cliente consulta el progreso con GET. Un
// modelo que no se puede comprobar —sin análisis, sin combinaciones, sin secciones
// asignadas— falla aquí como 4xx, porque el payload se arma antes de que el job se
// vaya a segundo plano.
const run = asyncHandler(async (req, res) => {
  const started = await designService.run(req.project, req.body?.preferences);
  res.status(202).json(started);
});

const get = asyncHandler(async (req, res) => {
  res.json(await designService.get(req.projectId));
});

const cancel = asyncHandler(async (req, res) => {
  res.json({ cancelled: designService.cancel(req.projectId) });
});

const listRuns = asyncHandler(async (req, res) => {
  res.json(await designService.listRuns(req.projectId));
});

// URL prefirmadas de las cinco tablas de una comprobación, de una tacada: la sección
// Design las necesita juntas para pintar la primera pantalla.
const runUrls = asyncHandler(async (req, res) => {
  res.json(await designService.signRun(req.projectId, req.params.runId));
});

module.exports = { run, get, cancel, listRuns, runUrls };
