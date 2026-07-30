// Generador de la curva de DISEÑO de ASCE/SEI 7-22 (Estados Unidos), forma de dos
// periodos (Sección 11.4.5.2).
//
// Port 1:1 de src/lib/asce7Spectrum.ts del frontend: mismas ecuaciones, mismo JSON
// (`asce7-22_seismic.json`).
//
//   T0 = 0.2·SD1/SDS   Ts = SD1/SDS
//   T < T0        Sa = SDS·(0.4 + 0.6·T/T0)
//   T0 ≤ T ≤ Ts   Sa = SDS
//   Ts < T ≤ TL   Sa = SD1 / T
//   T > TL        Sa = SD1·TL / T²
//
// En ASCE la reducción NO está en la curva sino en la fuerza: lo que entra al análisis
// es Sa/(R/Ie). Por eso la ordenada de diseño que se muestrea aquí es reducedOrdinate =
// designOrdinate / (R/Ie), igual que la línea "design" que dibuja el editor.
const { sampleGrid } = require("./grid");

const RAMP_BASE = 0.4;
const RAMP_SLOPE = 0.6;
const TS_FACTOR = 0.2; // T0 = 0.2·Ts

function findSystem(code, id) {
  const categories = code.seismicForceResistingSystems.categories;
  for (const key of Object.keys(categories)) {
    const found = categories[key].systems.find((s) => s.id === id);
    if (found) return found;
  }
  return undefined;
}

function resolve(code, params) {
  if (!(params.SDS > 0)) throw new Error("SDS debe ser mayor que cero");
  if (!(params.SD1 > 0)) throw new Error("SD1 debe ser mayor que cero");
  if (!(params.TL > 0)) throw new Error("TL debe ser mayor que cero");

  const Ie = code.importanceFactor.Ie[params.riskCategory];
  if (Ie == null) throw new Error(`Categoría de riesgo desconocida: ${params.riskCategory}`);

  const system = findSystem(code, params.systemId);
  if (!system) throw new Error(`Sistema estructural desconocido: ${params.systemId}`);

  const Ts = params.SD1 / params.SDS;
  return {
    SDS: params.SDS,
    SD1: params.SD1,
    TL: params.TL,
    T0: TS_FACTOR * Ts,
    Ts,
    RoverIe: system.R / Ie,
  };
}

// Ordenada del espectro de DISEÑO de la norma (sin dividir por R/Ie), en fracción de g.
function designOrdinate(r, T) {
  if (T < r.T0) return r.SDS * (RAMP_BASE + RAMP_SLOPE * (T / r.T0));
  if (T <= r.Ts) return r.SDS;
  if (T <= r.TL) return r.SD1 / T;
  return (r.SD1 * r.TL) / (T * T);
}

// Lo que de verdad entra al análisis: Sa/(R/Ie).
function reducedOrdinate(r, T) {
  return designOrdinate(r, T) / r.RoverIe;
}

function sample(code, params, options) {
  const r = resolve(code, params);
  // TL va de 4 a 16 s: hay que estirar el rango para que la última rama entre.
  const tMax = Math.max(10, r.TL * 1.25);
  const opts = { tMax, ...(options || {}) };
  return sampleGrid((T) => reducedOrdinate(r, T), [r.T0, r.Ts, r.TL], opts);
}

module.exports = { sample, resolve, designOrdinate, reducedOrdinate };
