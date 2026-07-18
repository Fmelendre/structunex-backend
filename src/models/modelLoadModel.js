const { Schema, model } = require("mongoose");

// A point load at a node. Multiple loads per node are allowed (not unique).
const loadSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    nodeId: { type: String, required: true },
    loadPattern: { type: String, required: true }, // Load Pattern name
    fx: { type: Number, default: 0 },
    fy: { type: Number, default: 0 },
    fz: { type: Number, default: 0 },
    mx: { type: Number, default: 0 },
    my: { type: Number, default: 0 },
    mz: { type: Number, default: 0 },
  },
  { collection: "model_loads", timestamps: true }
);

loadSchema.index({ projectId: 1 });

module.exports = { ModelLoad: model("ModelLoad", loadSchema) };
