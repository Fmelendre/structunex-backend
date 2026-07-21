const { Schema, model } = require("mongoose");

// One document per area element (wall/slab/shell), related to its project by
// projectId. Defined by its boundary node domain ids. areaSectionId points to a
// CatalogAreaSection (optional: an area can exist before a section is assigned).
// Optional per-area auto-mesh divisions (SAP2000 "Auto Mesh Into N x M Objects").
// Absent => the calc-service uses its automatic default density.
const areaMeshSchema = new Schema(
  {
    along12: { type: Number, min: 1, max: 100 }, // divisions along edge nodes 1->2
    along13: { type: Number, min: 1, max: 100 }, // divisions along the adjacent edge
  },
  { _id: false }
);

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
    mesh: { type: areaMeshSchema, default: undefined }, // per-area mesh divisions (optional)
    // Local axes orientation about the normal (local 3), in degrees (SAP2000 area
    // "local axis angle"). Default 0.
    localAxisAngle: { type: Number, default: 0 },
  },
  { collection: "model_areas", timestamps: true }
);

// Unique domain id within a project; also serves "all areas of a project".
areaSchema.index({ projectId: 1, id: 1 }, { unique: true });

module.exports = { ModelArea: model("ModelArea", areaSchema) };
