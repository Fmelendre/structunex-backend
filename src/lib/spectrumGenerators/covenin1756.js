// Generador de la curva de DISEÑO de COVENIN 1756-1:2001 (Venezuela).
//
// Port 1:1 de src/lib/coveninSpectrum.ts del frontend: mismas ecuaciones, mismo JSON
// (`norma.json`, servido por el backend). El front lo mantiene para el gráfico; aquí es
// la fuente autoritativa que alimenta el análisis. Solo se muestrea la ordenada de
// diseño (reducida por R), en fracción de g.
//
//   T < T⁺        Ad = α·φ·Ao·[1 + (T/T⁺)·(β/R − 1)]
//   T⁺ ≤ T ≤ T*   Ad = α·φ·Ao·β / R
//   T > T*        Ad = (α·φ·Ao·β/R)·(T*/T)^p
//   T⁺ = 0.1·(R−1) si R < 5 ; 0.4 si R ≥ 5
const { sampleGrid } = require("./grid");

// El texto de la tabla 5.1 marca las notas entre paréntesis: "S3(a)", "S2(c)".
const SHAPE_NOTE = /^(S[1-4])(?:\((\w)\))?$/;
// Umbral de la nota (a): con Ao ≤ 0.15 la forma pasa a S4.
const NOTE_A_AO = 0.15;

function factorR(code, material, nivelDiseno, tipoEstructural) {
  const byMaterial = code.R && code.R[material];
  const byLevel = byMaterial && byMaterial[nivelDiseno];
  const value = byLevel && byLevel[tipoEstructural];
  return value == null ? null : value;
}

// T⁺: donde acaba la rama de subida y empieza la meseta (Art. 7.2).
function periodTplus(R) {
  return R < 5 ? 0.1 * (R - 1) : 0.4;
}

function resolve(code, params) {
  const zona = code.zonas.find((z) => z.zona === params.zona);
  if (!zona) throw new Error(`Zona sísmica desconocida: ${params.zona}`);
  if (zona.Ao == null) {
    throw new Error(`La zona ${params.zona} no tiene espectro (Ao nulo)`);
  }
  const Ao = zona.Ao;

  const fila = code.tabla51.filas.find((f) => f.id === params.soilId);
  if (!fila) throw new Error(`Perfil de suelo desconocido: ${params.soilId}`);

  // Cada fila trae dos columnas: zonas 1-4 y zonas 5-7, cada una [forma espectral, φ].
  const [rawForma, phi] = params.zona <= 4 ? fila.z14 : fila.z57;
  const match = SHAPE_NOTE.exec(rawForma);
  if (!match) throw new Error(`Forma espectral ilegible: ${rawForma}`);
  let forma = match[1];
  const note = match[2];
  // "Si Ao ≤ 0.15 úsese S4": mecánico, se aplica. La nota (c) depende de H1/H, que no se
  // pide aquí, así que NO se aplica sola (el front la muestra como aviso).
  if (note === "a" && Ao <= NOTE_A_AO) forma = "S4";

  const shape = code.formasEspectrales[forma];
  if (!shape) throw new Error(`Forma espectral sin parámetros: ${forma}`);

  const alpha = code.alpha[params.grupo];
  if (alpha == null) throw new Error(`Grupo de uso desconocido: ${params.grupo}`);

  const R = factorR(code, params.material, params.nivelDiseno, params.tipoEstructural);
  if (R == null) {
    throw new Error(
      `La norma no define R para ${params.material} / ${params.nivelDiseno} / tipo ${params.tipoEstructural}`
    );
  }

  return {
    Ao,
    phi,
    alpha,
    R,
    Tstar: shape.Tstar,
    beta: shape.beta,
    p: shape.p,
    To: code.To_factor * shape.Tstar,
    Tplus: periodTplus(R),
    plateau: (alpha * phi * Ao * shape.beta) / R,
  };
}

// Ordenada del espectro de DISEÑO (reducido por R) en fracción de g.
function designOrdinate(r, T) {
  const base = r.alpha * r.phi * r.Ao;
  if (T < r.Tplus) return base * (1 + (T / r.Tplus) * (r.beta / r.R - 1));
  if (T <= r.Tstar) return r.plateau;
  return r.plateau * Math.pow(r.Tstar / T, r.p);
}

function sample(code, params, options) {
  const r = resolve(code, params);
  return sampleGrid((T) => designOrdinate(r, T), [r.To, r.Tplus, r.Tstar], options);
}

module.exports = { sample, resolve, designOrdinate };
