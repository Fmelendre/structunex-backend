const { z } = require("zod");

// Zod validates the request body BEFORE it touches Mongo. These per-entity
// schemas back the sub-resource routes: the full object for POST, and
// `.partial()` for PATCH. They carry NO `.default()` — Mongoose fills defaults
// on insert, so `.partial()` never injects a default that would overwrite an
// unspecified field on update.

const node = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  z: z.number().optional(), // Mongoose default 0
});

// Barra: referencia una frame section del catálogo (CatalogFrameSection, que
// lleva su material). frameSectionId es opcional (se puede dibujar sin asignar).
const element = z.object({
  id: z.string().min(1),
  nodeA: z.string().min(1),
  nodeB: z.string().min(1),
  frameSectionId: z.string().optional(),
});

// Booleans/numbers below are optional (no Zod default) — Mongoose defaults them
// to false / 0 on insert.
const support = z.object({
  nodeId: z.string().min(1),
  dx: z.boolean().optional(),
  dy: z.boolean().optional(),
  dz: z.boolean().optional(),
  rx: z.boolean().optional(),
  ry: z.boolean().optional(),
  rz: z.boolean().optional(),
});

const load = z.object({
  nodeId: z.string().min(1),
  loadPattern: z.string().optional(),
  fx: z.number().optional(),
  fy: z.number().optional(),
  fz: z.number().optional(),
  mx: z.number().optional(),
  my: z.number().optional(),
  mz: z.number().optional(),
});

const loadDir = z.enum(["gx", "gy", "gz", "gravity"]);

// Carga sobre una barra: distribuida uniforme (fuerza/longitud) o puntual
// (fuerza en la posición relativa `dist` 0..1).
const frameLoad = z.object({
  elementId: z.string().min(1),
  loadPattern: z.string().min(1),
  kind: z.enum(["distributed", "point"]).optional(),
  dir: loadDir.optional(),
  value: z.number().optional(),
  dist: z.number().min(0).max(1).optional(),
});

// Carga uniforme de superficie sobre un área (fuerza/área).
const areaLoad = z.object({
  areaId: z.string().min(1),
  loadPattern: z.string().min(1),
  dir: loadDir.optional(),
  value: z.number().optional(),
});

// Elemento de área (muro/losa/shell), definido por sus nodos de contorno.
// sectionId (Area Section del catálogo) es opcional: un área puede dibujarse y
// persistirse antes de asignarle sección.
const area = z.object({
  id: z.string().min(1),
  nodeIds: z.array(z.string().min(1)).min(3),
  areaSectionId: z.string().optional(),
});

// Project holds metadata only; the structural model is built incrementally via
// the sub-resource routes. ownerId is NOT accepted from the client — the server
// derives it from the authenticated Clerk user (req.userId).
const modelParamsSchema = z
  .object({
    length: z.number().optional(),
    beamSupports: z.string().optional(),
    span: z.number().optional(),
    height: z.number().optional(),
    panels: z.number().int().optional(),
    supports: z.string().optional(),
    width: z.number().optional(),
    depth: z.number().optional(),
  })
  .partial();

const createProjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).optional(),
  templateId: z.string().optional(),
  params: modelParamsSchema.optional(),
  analysisType: z.string().optional(),
  dofPerNode: z.number().optional(),
  units: z.string().optional(),
  client: z.string().optional(),
  company: z.string().optional(),
  engineer: z.string().optional(),
  description: z.string().optional(),
});

const updateProjectMetaSchema = createProjectSchema.partial();

module.exports = {
  // Per-entity schemas — used by the sub-resource routes (full for POST,
  // .partial() for PATCH).
  node,
  element,
  support,
  load,
  area,
  frameLoad,
  areaLoad,
  createProjectSchema,
  updateProjectMetaSchema,
};
