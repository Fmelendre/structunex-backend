// Muestreo común a los generadores normativos: una rejilla regular en [0, tMax] con los
// quiebres de la curva insertados aparte (si no, redondear al paso desdibuja las mesetas
// y los picos). Cada generador solo aporta su ordenada de DISEÑO (fracción de g) y sus
// periodos notables; esto arma la tabla `{T, accel}` que viaja al calc-service.
//
// El rango por defecto (0..10 s) es más ancho que el del gráfico del front (4 s) a
// propósito: la curva tiene que cubrir cualquier periodo modal realista, porque el
// calc-service NO extrapola fuera de la tabla — clampa al último punto.
function sampleGrid(ordinate, breakpoints, { tMax = 10, step = 0.02 } = {}) {
  const periods = new Set();
  for (let T = 0; T <= tMax + 1e-9; T += step) {
    // El acumulado en coma flotante desalinea la rejilla; se redondea al paso.
    periods.add(Math.round(T / step) * step);
  }
  for (const b of breakpoints) {
    if (b > 0 && b <= tMax) periods.add(b);
  }
  return [...periods]
    .sort((a, b) => a - b)
    .map((T) => ({ T, accel: ordinate(T) }));
}

module.exports = { sampleGrid };
