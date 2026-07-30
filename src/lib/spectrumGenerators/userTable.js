// Espectro traído por el usuario (el «From File» / «User» de ETABS y SAP2000).
//
// La única fuente que NO calcula: la curva viene de fuera y ya está persistida en
// `params.points` ({T, value}, valor en fracción de g). Aquí solo se hace passthrough a
// la forma `{T, accel}` del calc-service, con la misma normalización de forma que el
// front (`spectrumTable.ts::tableValid`): ordenada y periodo finitos y no negativos,
// ordenados por periodo, sin periodos repetidos y con al menos dos puntos.
//
// No se valida NADA normativo: el dato es del usuario. El front ya parsea/valida al
// importar; esto solo re-verifica la forma antes de mandarlo al solver.
function sample(params) {
  const raw = Array.isArray(params && params.points) ? params.points : [];

  const points = raw
    .filter(
      (p) =>
        p &&
        Number.isFinite(p.T) &&
        Number.isFinite(p.value) &&
        p.T >= 0 &&
        p.value >= 0
    )
    .map((p) => ({ T: p.T, accel: p.value }))
    .sort((a, b) => a.T - b.T);

  // Periodos repetidos: se queda el primero (dos ordenadas para un mismo T no es curva).
  const out = [];
  for (const p of points) {
    if (out.length > 0 && out[out.length - 1].T === p.T) continue;
    out.push(p);
  }

  if (out.length < 2) {
    throw new Error("La tabla de espectro del usuario necesita al menos dos puntos válidos");
  }
  return out;
}

module.exports = { sample };
