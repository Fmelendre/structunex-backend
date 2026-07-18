const { Schema, model } = require("mongoose");

// A load applied to a frame element (bar), tagged by its Load Pattern.
//  - kind "distributed": uniform force per unit length (value).
//  - kind "point": concentrated force (value) at relative position `dist` (0..1).
// `dir` is the load direction: global gx/gy/gz or "gravity" (−Z).
const frameLoadSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    elementId: { type: String, required: true }, // ModelElement domain id
    loadPattern: { type: String, required: true },
    kind: {
      type: String,
      enum: ["distributed", "point"],
      default: "distributed",
    },
    dir: {
      type: String,
      enum: ["gx", "gy", "gz", "gravity"],
      default: "gravity",
    },
    value: { type: Number, default: 0 },
    dist: { type: Number }, // point: posición relativa 0..1
  },
  { collection: "model_frame_loads", timestamps: true }
);

frameLoadSchema.index({ projectId: 1 });

module.exports = { ModelFrameLoad: model("ModelFrameLoad", frameLoadSchema) };
