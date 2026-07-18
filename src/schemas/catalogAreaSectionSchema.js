const { z } = require("zod");

// Catálogo de secciones de área por usuario (réplica del "Shell Section Data"
// de SAP2000). v1: solo kind "shell". ownerId se toma del token de Clerk, nunca
// del body. materialId se valida (pertenencia) en el servicio.

const SHELL_TYPES = [
  "shell-thin",
  "shell-thick",
  "plate-thin",
  "plate-thick",
  "membrane",
];

// Modificadores de rigidez: membrana (f11/f22/f12), flexión (m11/m22/m12),
// cortante transversal (v13/v23), masa y peso. Default 1 (sin modificar).
const modifier = z.number().nonnegative().default(1);
const modifiers = z
  .object({
    f11: modifier,
    f22: modifier,
    f12: modifier,
    m11: modifier,
    m22: modifier,
    m12: modifier,
    v13: modifier,
    v23: modifier,
    mass: modifier,
    weight: modifier,
  })
  .default({});

const createCatalogAreaSection = z.object({
  name: z.string().min(1),
  kind: z.literal("shell").default("shell"),
  shellType: z.enum(SHELL_TYPES),
  materialId: z.string().min(1), // ObjectId validado en el servicio
  materialAngle: z.number().default(0),
  thicknessMembrane: z.number().positive(),
  thicknessBending: z.number().positive(),
  modifiers,
  color: z.string().optional(),
});

const updateCatalogAreaSection = createCatalogAreaSection.partial();

module.exports = { createCatalogAreaSection, updateCatalogAreaSection };
