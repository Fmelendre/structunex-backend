const axios = require("axios");
const { env } = require("../config/env");
const { AppError } = require("../middleware/errorHandler");

// Talks to the Python calc-service. Node NEVER solves - it delegates.
// For the MVP these are direct HTTP calls; later they can be pushed onto a
// BullMQ queue and a worker calls this instead.

// Translates an axios failure from the calc-service into an AppError that keeps
// the real reason. The service returns 422 with { detail: {error, message,
// nodeIds?, dofs?} } for caller model errors, 500 for a solver bug. A missing
// response means the service is down / timed out.
function fromCalcError(err) {
  if (!err.response) {
    return new AppError(
      502,
      `No se pudo contactar el calc-service (${err.code || err.message}). ` +
        `¿Está levantado en ${env.calcServiceUrl}?`
    );
  }
  const { status, data } = err.response;
  const detail = data && data.detail;
  // 404 aquí no es un modelo inválido: significa que la ruta no existe en el
  // calc-service que responde (típicamente un proceso viejo sin /analyze).
  if (status === 404) {
    return new AppError(
      502,
      `El calc-service en ${env.calcServiceUrl} no expone la ruta pedida (404). ` +
        `Probablemente corre una versión antigua: reinícialo con el código actual.`
    );
  }
  let message;
  if (detail && typeof detail === "object" && detail.message) {
    message = detail.message;
  } else if (typeof detail === "string") {
    message = detail;
  } else {
    message = `Calc service error (${status})`;
  }
  // 422 = the caller's model is at fault (surface it as-is); anything else is a
  // solver/infra problem → 502 upstream.
  const code = status === 422 ? 422 : 502;
  return new AppError(
    code,
    message,
    detail && typeof detail === "object" ? detail : undefined
  );
}

// Condition-based, multi-pattern engine. `request` is { analysisOptions, model }.
// Returns { patterns, activeDofs, solvedAt, notes }.
async function analyzeModel(request) {
  try {
    const { data } = await axios.post(`${env.calcServiceUrl}/analyze`, request, {
      timeout: 60000,
    });
    return data;
  } catch (err) {
    throw fromCalcError(err);
  }
}

module.exports = { analyzeModel };
