const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateDefaultCombos } = require("./loadComboService");

// Runner integrado de Node:  node --test src/services/loadComboService.test.js

const PATTERNS = [
  { name: "Dead", type: "dead" },
  { name: "Live", type: "live" },
  { name: "Snow", type: "snow" },
  { name: "Quake", type: "quake" }, // no debe usarse: el sísmico va por marcador
];

test("expande términos no sísmicos a los patrones por tipo", () => {
  const { combos } = generateDefaultCombos({
    loadPatterns: PATTERNS,
    responseSpectrumCases: [{ name: "RS" }],
    sets: ["LRFD"],
  });
  // 1.4D existe en LRFD y solo tiene D.
  const dead = combos.find((c) => c.name.startsWith("1.4D"));
  assert.ok(dead, "debe existir el combo 1.4D");
  assert.deepEqual(dead.factors, [{ pattern: "Dead", factor: 1.4 }]);
});

test("el término sísmico E es un marcador name-free en pares ±", () => {
  const { combos } = generateDefaultCombos({
    loadPatterns: PATTERNS,
    responseSpectrumCases: [{ name: "RS" }],
    sets: ["LRFD"],
  });
  const plus = combos.filter((c) => c.name.includes("(+E)"));
  const minus = combos.filter((c) => c.name.includes("(-E)"));
  assert.ok(plus.length > 0, "debe generar combos +E");
  assert.equal(plus.length, minus.length, "±E deben venir en pares");

  // Ningún término guarda el nombre del caso RS; el sísmico es un marcador.
  const seismicTerms = combos.flatMap((c) => c.factors).filter((f) => f.seismic);
  assert.ok(seismicTerms.length > 0);
  for (const t of seismicTerms) {
    assert.equal(t.seismic, true);
    assert.equal(t.pattern, undefined, "el término sísmico no lleva pattern");
  }
  // El +E tiene factor sísmico positivo y el −E el opuesto.
  const plusF = plus[0].factors.find((f) => f.seismic).factor;
  const minusName = plus[0].name.replace("(+E)", "(-E)");
  const paired = combos.find((c) => c.name === minusName);
  assert.ok(paired, "cada +E tiene su −E");
  const minusF = paired.factors.find((f) => f.seismic).factor;
  assert.ok(plusF > 0);
  assert.equal(minusF, -plusF);
});

test("sin casos Response Spectrum no se emiten combos sísmicos", () => {
  const { combos } = generateDefaultCombos({
    loadPatterns: PATTERNS,
    responseSpectrumCases: [],
    sets: ["LRFD"],
  });
  const seismic = combos.filter((c) => c.factors.some((f) => f.seismic));
  assert.equal(seismic.length, 0);
  // Y no debe colarse el patrón quake como término.
  const quakeTerm = combos.flatMap((c) => c.factors).find((f) => f.pattern === "Quake");
  assert.equal(quakeTerm, undefined);
});

test("nombres únicos frente a reservedNames", () => {
  const { combos } = generateDefaultCombos({
    loadPatterns: PATTERNS,
    responseSpectrumCases: [],
    sets: ["LRFD"],
    reservedNames: ["1.4D"],
  });
  const dead = combos.find((c) => c.factors.length === 1 && c.factors[0].pattern === "Dead");
  assert.ok(dead && dead.name !== "1.4D", "debe renombrar para no colisionar");
});
