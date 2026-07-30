// Paridad de los generadores de curva con las ecuaciones de norma (y, por tanto, con los
// módulos TS del front que resuelven las mismas). Se ancla a valores CERRADOS que ambas
// implementaciones deben clavar — no a números copiados de la otra — así el test cae si
// el port se desvía de la norma, no solo si difiere del front.
//
// Runner integrado de Node 22 (sin dependencias):  node --test src/lib/spectrumGenerators
const test = require("node:test");
const assert = require("node:assert/strict");

const generators = require("./index");
const { getCode } = require("../seismicCodeCatalog");

// Ordenada muestreada más cercana a un periodo (las curvas insertan sus quiebres, así que
// el punto exacto suele estar).
function at(points, T) {
  return points.reduce((best, p) =>
    Math.abs(p.T - T) < Math.abs(best.T - T) ? p : best
  ).accel;
}

test("ASCE 7-22: reduced ordinate is Sa/(R/Ie), closed form", () => {
  // SDS=1, SD1=0.6 (Ts=0.6, T0=0.12), R=8, Ie=1 (Cat II) => R/Ie = 8.
  const pts = generators.sample({
    source: "asce7-22",
    damping: 0.05,
    params: {
      SDS: 1.0, SD1: 0.6, TL: 8,
      siteClass: "CD", riskCategory: "II",
      systemId: "mf-steel-special-moment-frames-smf",
    },
  });
  assert.ok(pts.length >= 2);
  assert.ok(Math.abs(at(pts, 0) - 0.4 / 8) < 1e-9, "T=0: 0.4·SDS / (R/Ie)");
  assert.ok(Math.abs(at(pts, 0.3) - 1.0 / 8) < 1e-9, "plateau SDS / (R/Ie)");
  assert.ok(Math.abs(at(pts, 2.0) - (0.6 / 2.0) / 8) < 1e-9, "descending SD1/T / (R/Ie)");
  assert.ok(pts[pts.length - 1].T >= 10, "range covers long periods");
});

test("COVENIN 1756: ground accel at T=0 and reduced plateau", () => {
  const code = getCode("covenin-1756");
  const params = {
    zona: 5, soilId: "duros-2", grupo: "B2",
    material: "concreto", nivelDiseno: "ND3", tipoEstructural: "I",
  };
  const r = require("./covenin1756").resolve(code, params);
  const pts = generators.sample({ source: "covenin1756", params });

  const ground = r.alpha * r.phi * r.Ao; // T=0: la curva arranca en la aceleración del suelo
  assert.ok(Math.abs(at(pts, 0) - ground) < 1e-6, "T=0 == alpha·phi·Ao");
  // En la meseta [T⁺, T*] la ordenada es alpha·phi·Ao·beta/R.
  const midPlateau = (r.Tplus + r.Tstar) / 2;
  assert.ok(Math.abs(at(pts, midPlateau) - r.plateau) < 1e-6, "meseta == alpha·phi·Ao·beta/R");
  // Pasado T* decae como (T*/T)^p.
  const Tfar = Math.min(9.9, r.Tstar * 3);
  assert.ok(
    Math.abs(at(pts, Tfar) - r.plateau * Math.pow(r.Tstar / Tfar, r.p)) < 1e-6,
    "rama descendente (T*/T)^p"
  );
});

test("NCh433: alpha(T0)=2.75 gives design = S·A0·I·2.75 / R*", () => {
  const code = getCode("nch433");
  const params = { zona: 2, soilType: "C", categoria: "II", systemId: "ha-muros", Tstar: 0.85 };
  const r = require("./nch433").resolve(code, params);
  const pts = generators.sample({ source: "nch433", params });

  const designAtT0 = (r.S * r.A0 * r.I * 2.75) / r.Rstar;
  assert.ok(Math.abs(at(pts, r.T0) - designAtT0) < 1e-6, "alpha(T0)=2.75");
});

test("userTable: passthrough, sorted, deduped, clamped shape", () => {
  const pts = generators.sample({
    source: "userTable",
    params: {
      points: [
        { T: 0.6, value: 1.0 },
        { T: 0.0, value: 0.4 }, // fuera de orden
        { T: 0.6, value: 9.9 }, // periodo repetido -> se ignora
        { T: 2.0, value: 0.3 },
      ],
    },
  });
  assert.deepEqual(pts, [
    { T: 0.0, accel: 0.4 },
    { T: 0.6, accel: 1.0 },
    { T: 2.0, accel: 0.3 },
  ]);
});

test("userTable: fewer than two valid points is an error", () => {
  assert.throws(() =>
    generators.sample({ source: "userTable", params: { points: [{ T: 0, value: 1 }] } })
  );
});

test("unknown source throws", () => {
  assert.throws(() => generators.sample({ source: "nope", params: {} }));
});

test("every source yields a fraction-of-g curve with >= 2 points", () => {
  const cases = [
    { source: "covenin1756", params: { zona: 5, soilId: "duros-2", grupo: "B2", material: "concreto", nivelDiseno: "ND3", tipoEstructural: "I" } },
    { source: "nch433", params: { zona: 2, soilType: "C", categoria: "II", systemId: "ha-muros", Tstar: 0.85 } },
    { source: "asce7-22", params: { SDS: 1.0, SD1: 0.6, TL: 8, riskCategory: "II", systemId: "mf-steel-special-moment-frames-smf" } },
  ];
  for (const c of cases) {
    const pts = generators.sample({ ...c, damping: 0.05 });
    assert.ok(pts.length >= 2, `${c.source} has >= 2 points`);
    for (const p of pts) {
      assert.ok(Number.isFinite(p.T) && p.T >= 0, `${c.source} finite T`);
      assert.ok(Number.isFinite(p.accel) && p.accel >= 0 && p.accel < 5, `${c.source} sane accel`);
    }
  }
});
