const { isValidObjectId } = require("mongoose");
const { AppError } = require("../middleware/errorHandler");
const { CatalogFrameSection: Model, CatalogMaterial } = require("../models");
const { getShape } = require("../lib/aiscShapes");
const { computeSectionProps } = require("../lib/sectionGeometry");

// CRUD for the user-owned section catalog. Every document is addressed by its
// Mongo _id and always constrained to its owner. The solver-facing props
// (A/I33/I22/J) are computed here from the shape definition, never trusted from
// the body.
const notFound = () => new AppError(404, "CatalogFrameSection not found");

// Campos de definición usados por cada forma paramétrica (además de `shape`).
const SHAPE_DIMS = {
  rectangular: ["b", "h"],
  circular: ["d"],
  pipe: ["d", "t"],
  box: ["b", "h", "t"],
  ishape: ["d", "bfTop", "tfTop", "tw", "bfBot", "tfBot"],
  channel: ["d", "bf", "tf", "tw"],
  tee: ["d", "bf", "tf", "tw"],
  angle: ["d", "b", "t"],
};
// Todos los campos de definición posibles (para limpiar los no usados).
const ALL_DEF_FIELDS = [
  "catalogLabel",
  "shape",
  "A",
  "I33",
  "I22",
  "J",
  ...new Set(Object.values(SHAPE_DIMS).flat()),
];

// Campos de definición que conserva una sección según su source/shape.
function keepFields(def) {
  if (def.source === "catalog") return ["catalogLabel"];
  if (def.source === "general") return ["A", "I33", "I22", "J"];
  // parametric
  return ["shape", ...(SHAPE_DIMS[def.shape] || [])];
}

// Confirma que el material referenciado existe y pertenece al usuario.
async function assertMaterial(ownerId, materialId) {
  if (!isValidObjectId(materialId)) throw new AppError(400, "Material no válido");
  const mat = await CatalogMaterial.findOne({ _id: materialId, ownerId })
    .select("_id")
    .lean();
  if (!mat) throw new AppError(400, "Material no encontrado");
}

// Resuelve el perfil AISC (solo source catalog) y computa las props.
function resolveProps(def) {
  let shape;
  if (def.source === "catalog") {
    shape = getShape(def.catalogLabel);
    if (!shape) throw new AppError(400, "Perfil no encontrado");
  }
  return computeSectionProps(def, shape);
}

module.exports = {
  list: (ownerId) =>
    Model.find({ ownerId }).select("-__v").sort({ createdAt: -1 }).lean(),

  getOne: async (ownerId, id) => {
    if (!isValidObjectId(id)) throw notFound();
    const doc = await Model.findOne({ _id: id, ownerId }).select("-__v").lean();
    if (!doc) throw notFound();
    return doc;
  },

  create: async (ownerId, data) => {
    await assertMaterial(ownerId, data.materialId);
    const props = resolveProps(data);
    return Model.create({ ...data, ownerId, props });
  },

  update: async (ownerId, id, data) => {
    if (!isValidObjectId(id)) throw notFound();
    const existing = await Model.findOne({ _id: id, ownerId }).lean();
    if (!existing) throw notFound();

    // Definición efectiva = existente + parche (el discriminante `source`
    // siempre viene en el PATCH). Sirve para recomputar props de forma robusta
    // aunque el parche sea parcial.
    const def = { ...existing, ...data };
    await assertMaterial(ownerId, def.materialId);
    const props = resolveProps(def);

    const update = { $set: { ...data, props } };
    // Al cambiar de source/shape, limpiar los campos de definición no usados.
    const keep = keepFields(def);
    const drop = ALL_DEF_FIELDS.filter(
      (f) => !keep.includes(f) && !(f in data)
    );
    if (drop.length) update.$unset = Object.fromEntries(drop.map((k) => [k, ""]));

    const doc = await Model.findOneAndUpdate({ _id: id, ownerId }, update, {
      new: true,
      runValidators: true,
    });
    if (!doc) throw notFound();
    return doc;
  },

  remove: async (ownerId, id) => {
    if (!isValidObjectId(id)) throw notFound();
    const doc = await Model.findOneAndDelete({ _id: id, ownerId });
    if (!doc) throw notFound();
    return { deleted: true };
  },
};
