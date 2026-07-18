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
    .enum(["dead", "superDead", "live", "wind", "snow", "quake", "other"])
    .optional(),
  selfWeightMultiplier: z.number().optional(),
});

const configuration = z
  .object({
    gridSystem: gridSystem.nullable().optional(),
    defaultFrameSectionId: z.string().nullable().optional(),
    defaultAreaSectionId: z.string().nullable().optional(),
    loadPatterns: z.array(loadPattern).optional(),
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
