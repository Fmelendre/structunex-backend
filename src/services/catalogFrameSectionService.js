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

// Materiales admitidos por tipo de propiedad de la sección. `other` acepta
// cualquiera. Debe casar con las reglas del frontend/Zod.
const COMPATIBLE_MATERIAL = {
  concrete: ["concrete"],
  steel: ["steel"],
  other: null, // sin restricción
};

// Confirma que el material referenciado existe, pertenece al usuario y es
// coherente con el `propertyType` de la sección.
async function assertMaterial(ownerId, materialId, propertyType) {
  if (!isValidObjectId(materialId)) throw new AppError(400, "Material no válido");
  const mat = await CatalogMaterial.findOne({ _id: materialId, ownerId })
    .select("type")
    .lean();
  if (!mat) throw new AppError(400, "Material no encontrado");
  const allowed = COMPATIBLE_MATERIAL[propertyType];
  if (allowed && !allowed.includes(mat.type)) {
    throw new AppError(
      400,
      `El material (${mat.type}) no es coherente con una sección de tipo ${propertyType}`
    );
  }
  return mat;
}

// El material de armadura debe existir, pertenecer al usuario y ser armadura/acero.
async function assertRebarMaterial(ownerId, materialId) {
  if (!isValidObjectId(materialId))
    throw new AppError(400, "Material de armadura no válido");
  const mat = await CatalogMaterial.findOne({ _id: materialId, ownerId })
    .select("type")
    .lean();
  if (!mat) throw new AppError(400, "Material de armadura no encontrado");
  if (!["rebar", "steel"].includes(mat.type))
    throw new AppError(400, "El material de armadura debe ser de tipo armadura o acero");
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
    await assertMaterial(ownerId, data.materialId, data.propertyType);
    if (data.reinforcement && data.reinforcement.rebarMaterialId) {
      await assertRebarMaterial(ownerId, data.reinforcement.rebarMaterialId);
    }
    const props = resolveProps(data);
    const doc = { ...data, ownerId, props };
    // El armado sólo tiene sentido en hormigón.
    if (doc.propertyType !== "concrete") delete doc.reinforcement;
    return Model.create(doc);
  },

  update: async (ownerId, id, data) => {
    if (!isValidObjectId(id)) throw notFound();
    const existing = await Model.findOne({ _id: id, ownerId }).lean();
    if (!existing) throw notFound();

    // Definición efectiva = existente + parche (el discriminante `source`
    // siempre viene en el PATCH). Sirve para recomputar props de forma robusta
    // aunque el parche sea parcial.
    const def = { ...existing, ...data };
    await assertMaterial(ownerId, def.materialId, def.propertyType);
    if (def.reinforcement && def.reinforcement.rebarMaterialId) {
      await assertRebarMaterial(ownerId, def.reinforcement.rebarMaterialId);
    }
    const props = resolveProps(def);

    const set = { ...data, props };
    // Al cambiar de source/shape, limpiar los campos de definición no usados.
    const keep = keepFields(def);
    const drop = ALL_DEF_FIELDS.filter(
      (f) => !keep.includes(f) && !(f in data)
    );
    // El armado sólo vive en hormigón: al dejar de serlo, se elimina.
    if (def.propertyType !== "concrete") {
      delete set.reinforcement;
      drop.push("reinforcement");
    }
    const update = { $set: set };
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
