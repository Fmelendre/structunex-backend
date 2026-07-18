const { z } = require("zod");

// Catálogo de secciones por usuario. Unión por `source` (catalog | parametric |
// general); en parametric, sub-unión por `shape` (8 formas). Toda sección
// resuelve a A/I33/I22/J (las computa el servicio, no vienen del body).
// ownerId se toma del token de Clerk, nunca del body.

const modifiers = z
  .object({
    area: z.number().positive().default(1),
    i33: z.number().positive().default(1),
    i22: z.number().positive().default(1),
    j: z.number().positive().default(1),
  })
  .default({});

// Formas paramétricas válidas por tipo de propiedad. El hormigón se limita a
// las macizas habituales (rect/circ/tee); el acero y "other", a todas. Debe
// coincidir con SHAPES_BY_TYPE del frontend (section-dialog.tsx).
const ALL_SHAPES = [
  "rectangular",
  "circular",
  "pipe",
  "box",
  "ishape",
  "channel",
  "tee",
  "angle",
];
const SHAPES_BY_TYPE = {
  steel: ALL_SHAPES,
  concrete: ["rectangular", "circular", "tee"],
  other: ALL_SHAPES,
};

// Armado (solo hormigón). Superset viga+columna; sólo designRole y cover son
// obligatorios (el resto se rellena según el diseño). No lo consume el solver.
const reinforcement = z.object({
  designRole: z.enum(["beam", "column"]),
  rebarMaterialId: z.string().min(1).optional(), // ObjectId validado en servicio
  cover: z.number().positive(),
  // Columna
  pattern: z.enum(["rectangular", "circular"]).optional(),
  longBarDia: z.number().positive().optional(),
  numBars3: z.number().int().positive().optional(),
  numBars2: z.number().int().positive().optional(),
  numBarsCirc: z.number().int().positive().optional(),
  tieBarDia: z.number().positive().optional(),
  tieSpacing: z.number().positive().optional(),
  confinement: z.enum(["ties", "spiral"]).optional(),
  // Viga
  coverTop: z.number().positive().optional(),
  coverBot: z.number().positive().optional(),
});

const base = {
  name: z.string().min(1),
  materialId: z.string().min(1), // ObjectId validado en el servicio (pertenencia)
  // Tipo de propiedad (estilo SAP). La coherencia material.type == propertyType
  // se valida en el servicio (requiere DB); aquí van las reglas sin DB.
  propertyType: z.enum(["steel", "concrete", "other"]).default("steel"),
  reinforcement: reinforcement.optional(),
  modifiers,
  color: z.string().optional(), // display color (hex)
};

// Reglas de coherencia por tipo (sin DB). Tolerantes con parches parciales:
// solo se aplican cuando los campos implicados están presentes.
function withTypeRules(schema) {
  return schema
    .refine((v) => v.source !== "catalog" || v.propertyType !== "concrete", {
      message: "El hormigón no admite perfiles de catálogo AISC",
      path: ["source"],
    })
    .refine((v) => v.propertyType !== "concrete" || v.reinforcement != null, {
      message: "Las secciones de hormigón requieren armado",
      path: ["reinforcement"],
    })
    .refine(
      (v) =>
        v.source !== "parametric" ||
        v.shape == null ||
        v.propertyType == null ||
        SHAPES_BY_TYPE[v.propertyType].includes(v.shape),
      { message: "La forma no es válida para este tipo de sección", path: ["shape"] }
    );
}

// --- source: catalog / general ---
const catalog = z.object({
  source: z.literal("catalog"),
  ...base,
  catalogLabel: z.string().min(1),
});

const general = z.object({
  source: z.literal("general"),
  ...base,
  A: z.number().positive(),
  I33: z.number().positive(),
  I22: z.number().positive().optional(),
  J: z.number().positive().optional(),
});

// --- source: parametric, una variante por shape ---
const pos = () => z.number().positive();
const paramBase = { source: z.literal("parametric"), ...base };

const rectangular = z.object({ ...paramBase, shape: z.literal("rectangular"), b: pos(), h: pos() });
const circular = z.object({ ...paramBase, shape: z.literal("circular"), d: pos() });
const pipe = z
  .object({ ...paramBase, shape: z.literal("pipe"), d: pos(), t: pos() })
  .refine((v) => v.t < v.d / 2, { message: "El espesor t debe ser menor que d/2", path: ["t"] });
const box = z
  .object({ ...paramBase, shape: z.literal("box"), b: pos(), h: pos(), t: pos() })
  .refine((v) => 2 * v.t < Math.min(v.b, v.h), {
    message: "El espesor t debe ser menor que min(b,h)/2",
    path: ["t"],
  });
const ishape = z.object({
  ...paramBase,
  shape: z.literal("ishape"),
  d: pos(),
  bfTop: pos(),
  tfTop: pos(),
  tw: pos(),
  bfBot: pos(),
  tfBot: pos(),
});
const channel = z.object({
  ...paramBase,
  shape: z.literal("channel"),
  d: pos(),
  bf: pos(),
  tf: pos(),
  tw: pos(),
});
const tee = z.object({
  ...paramBase,
  shape: z.literal("tee"),
  d: pos(),
  bf: pos(),
  tf: pos(),
  tw: pos(),
});
const angle = z.object({ ...paramBase, shape: z.literal("angle"), d: pos(), b: pos(), t: pos() });

const PARAMETRIC = { rectangular, circular, pipe, box, ishape, channel, tee, angle };

// Doble discriminante (source; y shape dentro de parametric) + refines →
// discriminatedUnion no basta. Elegimos la variante a mano y exponemos
// safeParse para encajar con el middleware validate().
function pickCreate(data) {
  if (data && data.source === "parametric") {
    return PARAMETRIC[data && data.shape] || rectangular;
  }
  if (data && data.source === "general") return general;
  return catalog;
}

// --- UPDATE: variantes parciales con el/los discriminante(s) obligatorio(s) ---
const catalogU = catalog.partial().required({ source: true });
const generalU = general.partial().required({ source: true });

// Para parametric, cada shape parcial pero conservando source+shape. Los
// refines de pipe/box se re-aplican de forma condicional (solo si las cotas
// implicadas vienen en el parche).
function unwrap(shapeSchema) {
  return shapeSchema._def && shapeSchema._def.schema
    ? shapeSchema._def.schema
    : shapeSchema;
}
function partialParam(shapeSchema) {
  return unwrap(shapeSchema).partial().required({ source: true, shape: true });
}
const PARAMETRIC_U = Object.fromEntries(
  Object.entries(PARAMETRIC).map(([k, v]) => [k, partialParam(v)])
);
PARAMETRIC_U.pipe = PARAMETRIC_U.pipe.refine(
  (v) => v.d == null || v.t == null || v.t < v.d / 2,
  { message: "El espesor t debe ser menor que d/2", path: ["t"] }
);
PARAMETRIC_U.box = PARAMETRIC_U.box.refine(
  (v) => v.b == null || v.h == null || v.t == null || 2 * v.t < Math.min(v.b, v.h),
  { message: "El espesor t debe ser menor que min(b,h)/2", path: ["t"] }
);

function pickUpdate(data) {
  if (data && data.source === "parametric") {
    return PARAMETRIC_U[data && data.shape] || PARAMETRIC_U.rectangular;
  }
  if (data && data.source === "general") return generalU;
  return catalogU;
}

const createSchema = {
  safeParse: (data) => withTypeRules(pickCreate(data)).safeParse(data),
};
const updateSchema = {
  safeParse: (data) => withTypeRules(pickUpdate(data)).safeParse(data),
};

module.exports = {
  createCatalogFrameSection: createSchema,
  updateCatalogFrameSection: updateSchema,
};
