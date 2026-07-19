const { z } = require("zod");
const {
  node,
  element,
  support,
  load,
  area,
  frameLoad,
  areaLoad,
} = require("./projectSchema");

// Configuración no-geométrica del modelo (grid + defaults). Un único doc por
// proyecto; se envía como objeto (no array) y el backend hace upsert.
const gridLine = z.object({ id: z.string().min(1), ordinate: z.number() });
const gridSystem = z.object({
  x: z.array(gridLine),
  y: z.array(gridLine),
  z: z.array(gridLine),
});
const loadPattern = z.object({
  name: z.string().min(1),
  type: z
    .enum([
      "dead",
      "superDead",
      "live",
      "roofLive",
      "wind",
      "snow",
      "rain",
      "quake",
      "other",
    ])
    .optional(),
  selfWeightMultiplier: z.number().optional(),
});

// Combinación de carga: suma lineal de patrones (pattern = loadPatterns[].name).
const comboFactor = z.object({
  pattern: z.string().min(1),
  factor: z.number(),
});
const loadCombination = z.object({
  name: z.string().min(1),
  factors: z.array(comboFactor),
});

// Mass Source (Define → Mass Source): masa para el análisis modal futuro.
const massMultiplier = z.object({
  pattern: z.string().min(1),
  multiplier: z.number(),
});
const massSource = z.object({
  name: z.string().min(1),
  elementSelfMass: z.boolean(),
  specifiedLoadPatterns: z.boolean(),
  multipliers: z.array(massMultiplier),
});

// Load Case tipo Modal (Define → Load Cases): parámetros del análisis modal.
const modalCase = z.object({
  name: z.string().min(1),
  typeOfModes: z.enum(["eigen", "ritz"]),
  maxModes: z.number().int().positive(),
  minModes: z.number().int().positive(),
});

const configuration = z
  .object({
    gridSystem: gridSystem.nullable().optional(),
    defaultFrameSectionId: z.string().nullable().optional(),
    defaultAreaSectionId: z.string().nullable().optional(),
    loadPatterns: z.array(loadPattern).optional(),
    loadCombinations: z.array(loadCombination).optional(),
    massSource: massSource.nullable().optional(),
    modalCases: z.array(modalCase).optional(),
  })
  .strict();

// Body del reconcile PUT /projects/:id/model. Cada clave es opcional: solo se
// reemplazan las colecciones presentes (delta por colección). Reutiliza los
// mismos schemas por entidad que las rutas de sub-recurso.
const modelSchema = z
  .object({
    nodes: z.array(node).optional(),
    elements: z.array(element).optional(),
    supports: z.array(support).optional(),
    loads: z.array(load).optional(),
    areas: z.array(area).optional(),
    frameLoads: z.array(frameLoad).optional(),
    areaLoads: z.array(areaLoad).optional(),
    configuration: configuration.optional(),
  })
  .strict();

module.exports = { modelSchema };
