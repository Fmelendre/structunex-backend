const { Schema, model } = require("mongoose");

// One document per structural node, related to its project by projectId.
const nodeSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    id: { type: String, required: true }, // domain id ("N1"), unique per project
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, default: 0 },
  },
  { collection: "model_nodes", timestamps: true }
);

// Unique domain id within a project; also serves "all nodes of a project".
nodeSchema.index({ projectId: 1, id: 1 }, { unique: true });

module.exports = { ModelNode: model("ModelNode", nodeSchema) };
