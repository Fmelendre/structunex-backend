const { isValidObjectId } = require("mongoose");
const { AppError } = require("../middleware/errorHandler");

// Builds the standard project-scoped CRUD for a child collection. Every
// document is addressed by its Mongo _id and always constrained to its project,
// so a child of another project is never reachable. Ownership was already
// checked upstream by loadProject.
function makeChildService(Model) {
  const notFound = () => new AppError(404, `${Model.modelName} not found`);

  return {
    list: (projectId) =>
      Model.find({ projectId }).select("-__v").sort({ createdAt: 1 }).lean(),

    getOne: async (projectId, id) => {
      if (!isValidObjectId(id)) throw notFound();
      const doc = await Model.findOne({ _id: id, projectId })
        .select("-__v")
        .lean();
      if (!doc) throw notFound();
      return doc;
    },

    create: (projectId, data) => Model.create({ ...data, projectId }),

    update: async (projectId, id, data) => {
      if (!isValidObjectId(id)) throw notFound();
      const doc = await Model.findOneAndUpdate({ _id: id, projectId }, data, {
        new: true,
        runValidators: true,
      });
      if (!doc) throw notFound();
      return doc;
    },

    remove: async (projectId, id) => {
      if (!isValidObjectId(id)) throw notFound();
      const doc = await Model.findOneAndDelete({ _id: id, projectId });
      if (!doc) throw notFound();
      return { deleted: true };
    },
  };
}

module.exports = { makeChildService };
