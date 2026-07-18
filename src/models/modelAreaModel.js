const { Schema, model } = require("mongoose");

// One document per area element (wall/slab/shell), related to its project by
// projectId. Defined by its boundary node domain ids. areaSectionId points to a
// CatalogAreaSection (optional: an area can exist before a section is assigned).
const areaSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    id: { type: String, required: true }, // domain id ("A1"), unique per project
    nodeIds: { type: [String], required: true }, // boundary node domain ids
    areaSectionId: { type: String }, // CatalogAreaSection _id (optional)
  },
  { collection: "model_areas", timestamps: true }
);

// Unique domain id within a project; also serves "all areas of a project".
areaSchema.index({ projectId: 1, id: 1 }, { unique: true });

module.exports = { ModelArea: model("ModelArea", areaSchema) };
