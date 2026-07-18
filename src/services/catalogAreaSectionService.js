const { isValidObjectId } = require("mongoose");
const { AppError } = require("../middleware/errorHandler");
const { CatalogAreaSection: Model, CatalogMaterial } = require("../models");

// CRUD for the user-owned area-section catalog. Every document is addressed by
// its Mongo _id and always constrained to its owner (req.userId). Mirror of
// catalogFrameSectionService, but area sections carry no computed solver props —
// thickness + material define the shell directly.
const notFound = () => new AppError(404, "CatalogAreaSection not found");

// Confirms the referenced material exists and belongs to the user.
async function assertMaterial(ownerId, materialId) {
  if (!isValidObjectId(materialId)) throw new AppError(400, "Material no válido");
  const mat = await CatalogMaterial.findOne({ _id: materialId, ownerId })
    .select("_id")
    .lean();
  if (!mat) throw new AppError(400, "Material no encontrado");
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
    return Model.create({ ...data, ownerId });
  },

  update: async (ownerId, id, data) => {
    if (!isValidObjectId(id)) throw notFound();
    if (data.materialId) await assertMaterial(ownerId, data.materialId);
    const doc = await Model.findOneAndUpdate({ _id: id, ownerId }, data, {
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
