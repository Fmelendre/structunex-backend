const { Schema, model } = require("mongoose");

// Boundary conditions at a node. One support per node within a project.
const supportSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    nodeId: { type: String, required: true },
    dx: { type: Boolean, default: false },
    dy: { type: Boolean, default: false },
    dz: { type: Boolean, default: false },
    rx: { type: Boolean, default: false },
    ry: { type: Boolean, default: false },
    rz: { type: Boolean, default: false },
  },
  { collection: "model_supports", timestamps: true }
);

supportSchema.index({ projectId: 1, nodeId: 1 }, { unique: true });

module.exports = { ModelSupport: model("ModelSupport", supportSchema) };
