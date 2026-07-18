const { z } = require("zod");

// Catálogo de materiales por usuario. Unión discriminada por `type`:
//  - Análisis (rigidez): E, nu, density?, alpha?  (G se deriva en el cliente).
//  - Diseño (verificación): hormigón f'c...; acero/armadura Fy, Fu...
// ownerId se toma del token de Clerk, nunca del body.

const base = {
  name: z.string().min(1),
  E: z.number().positive(), // módulo de Young (kPa)
  nu: z.number().min(0).max(0.5), // Poisson
  density: z.number().positive().optional(), // peso por volumen (kN/m³)
  alpha: z.number().positive().optional(), // coef. dilatación térmica
  color: z.string().optional(), // display color (hex)
};

const concrete = z.object({
  type: z.literal("concrete"),
  ...base,
  fc: z.number().positive(), // f'c (kPa)
  fcExpected: z.number().positive().optional(),
  lightweight: z.boolean().default(false),
  lambda: z.number().positive().optional(),
});

const steel = z.object({
  type: z.literal("steel"),
  ...base,
  Fy: z.number().positive(),
  Fu: z.number().positive(),
  Fye: z.number().positive().optional(),
  Fue: z.number().positive().optional(),
});

const rebar = steel.extend({ type: z.literal("rebar") });

const other = z.object({ type: z.literal("other"), ...base });

const createCatalogMaterial = z.discriminatedUnion("type", [
  concrete,
  steel,
  rebar,
  other,
]);

// PATCH: no se puede .partial() un discriminatedUnion → unión de variantes
// parciales con el discriminante (`type`) obligatorio.
const updateCatalogMaterial = z.discriminatedUnion("type", [
  concrete.partial().required({ type: true }),
  steel.partial().required({ type: true }),
  rebar.partial().required({ type: true }),
  other.partial().required({ type: true }),
]);

module.exports = { createCatalogMaterial, updateCatalogMaterial };
