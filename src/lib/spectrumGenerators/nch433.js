// Generador de la curva de DISEÑO de NCh433.Of96 Mod.2009 + DS N°61/2011 (Chile).
//
// Port 1:1 de src/lib/nch433Spectrum.ts del frontend: mismas ecuaciones, mismo JSON
// (`nch433_ds61_sismico.json`). Solo la ordenada de diseño (reducida por R*), en g.
//
//   Sa = (S·A0·α·I) / R*
//   α  = [1 + 4.5·(T/T0)^p] / [1 + (T/T0)^3]
//   R* = 1 + T* / (0.10·T0 + T*/R0)
//
// ⚠️ T* es el periodo del modo dominante (dato del usuario), NO el T* de esquina de
// COVENIN. Ver el aviso del módulo TS.
const { sampleGrid } = require("./grid");

const ALPHA_NUM = 4.5;
const ALPHA_DEN_EXP = 3;

function findSystem(code, id) {
  const groups = [
    code.factoresR.porticos,
    code.factoresR.murosYSistemasArriostrados,
  ];
  for (const g of groups) {
    const found = g.sistemas.find((s) => s.id === id);
    if (found) return found;
  }
  return undefined;
}

// R* = 1 + T*/(0.10·T0 + T*/R0): la reducción crece con la flexibilidad, no es de tabla.
function reductionFactor(Tstar, T0, R0) {
  return 1 + Tstar / (0.1 * T0 + Tstar / R0);
}

function resolve(code, params) {
  const zona = code.zonasSismicas.filas.find((z) => z.zona === params.zona);
  if (!zona) throw new Error(`Zona sísmica desconocida: ${params.zona}`);

  const soil = code.tiposDeSuelo.filas.find((f) => f.tipo === params.soilType);
  if (!soil) throw new Error(`Tipo de suelo desconocido: ${params.soilType}`);
  if (soil.S == null || soil.T0 == null || soil.p == null) {
    // El tipo F no tabula parámetros: requiere estudio de respuesta de sitio.
    throw new Error(`El suelo tipo ${params.soilType} no tiene parámetros tabulados`);
  }

  const cat = code.categoriasDeOcupacion.filas.find(
    (c) => c.categoria === params.categoria
  );
  if (!cat) throw new Error(`Categoría desconocida: ${params.categoria}`);

  const system = findSystem(code, params.systemId);
  if (!system) throw new Error(`Sistema estructural desconocido: ${params.systemId}`);
  if (system.R0 == null) {
    throw new Error(
      `El sistema «${system.material}» no define R0, no sirve para análisis modal espectral`
    );
  }

  if (!(params.Tstar > 0)) throw new Error("T* debe ser mayor que cero");

  return {
    A0: zona.A0,
    S: soil.S,
    T0: soil.T0,
    p: soil.p,
    I: cat.I,
    R0: system.R0,
    Tstar: params.Tstar,
    Rstar: reductionFactor(params.Tstar, soil.T0, system.R0),
  };
}

function alphaFactor(r, T) {
  const x = T / r.T0;
  return (1 + ALPHA_NUM * Math.pow(x, r.p)) / (1 + Math.pow(x, ALPHA_DEN_EXP));
}

// Ordenada del espectro de DISEÑO (reducido por R*) en fracción de g.
function designOrdinate(r, T) {
  return (r.S * r.A0 * r.I * alphaFactor(r, T)) / r.Rstar;
}

function sample(code, params, options) {
  const r = resolve(code, params);
  return sampleGrid((T) => designOrdinate(r, T), [r.T0], options);
}

module.exports = { sample, resolve, designOrdinate };
