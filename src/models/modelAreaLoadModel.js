const { Schema, model } = require("mongoose");

// A uniform surface load applied to an area element (shell), tagged by its Load
// Pattern. `value` is force per unit area; `dir` is global gx/gy/gz or "gravity".
const areaLoadSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    areaId: { type: String, required: true }, // ModelArea domain id
    loadPattern: { type: String, required: true },
    dir: {
      type: String,
      enum: ["gx", "gy", "gz", "gravity"],
      default: "gravity",
    },
    value: { type: Number, default: 0 },
  },
  { collection: "model_area_loads", timestamps: true }
);

areaLoadSchema.index({ projectId: 1 });

module.exports = { ModelAreaLoad: model("ModelAreaLoad", areaLoadSchema) };
