const { isValidObjectId } = require("mongoose");
const { AppError } = require("../middleware/errorHandler");
const { CatalogMaterial: Model } = require("../models");

// CRUD for the user-owned material catalog. Every document is addressed by its
// Mongo _id and always constrained to its owner, so another user's material is
// never reachable.
const notFound = () => new AppError(404, "CatalogMaterial not found");

module.exports = {
  list: (ownerId) =>
    Model.find({ ownerId }).select("-__v").sort({ createdAt: -1 }).lean(),

  getOne: async (ownerId, id) => {
    if (!isValidObjectId(id)) throw notFound();
    const doc = await Model.findOne({ _id: id, ownerId }).select("-__v").lean();
    if (!doc) throw notFound();
    return doc;
  },

  create: (ownerId, data) => Model.create({ ...data, ownerId }),

  update: async (ownerId, id, data) => {
    if (!isValidObjectId(id)) throw notFound();
    const update = { $set: data };
    // Al cambiar de tipo, limpiar los campos de diseño del tipo anterior.
    if (data.type) {
      const CONCRETE = ["fc", "fcExpected", "lightweight", "lambda"];
      const STEEL = ["Fy", "Fu", "Fye", "Fue"];
      const drop =
        data.type === "concrete"
          ? STEEL
          : data.type === "steel" || data.type === "rebar"
            ? CONCRETE
            : [...CONCRETE, ...STEEL];
      if (drop.length) {
        update.$unset = Object.fromEntries(drop.map((k) => [k, ""]));
      }
    }
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
