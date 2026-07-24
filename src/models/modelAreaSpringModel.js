const { Schema, model } = require("mongoose");

// A surface spring on an area element (SAP2000 "Assign > Area > Springs"): the
// modulus of subgrade reaction of the soil under a mat foundation.
//
// `stiffness` is stiffness per unit area — force/length per m², i.e. kN/m³ in the
// base units. The calc-service spreads it over the area's mesh joints by
// tributary area and grounds each one, so an area without a shell section (never
// meshed) cannot carry springs.
//
// Unlike an area load this carries no loadPattern: stiffness belongs to the
// model, not to a load case. At most one spring per area.
const areaSpringSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    areaId: { type: String, required: true }, // ModelArea domain id
    stiffness: { type: Number, default: 0 }, // kN/m³
    // The analysis is linear, so the spring works both ways regardless; this only
    // decides which direction the solver flags as uplift.
    resists: {
      type: String,
      enum: ["compressionOnly", "tensionOnly", "both"],
      default: "compressionOnly",
    },
    face: { type: String, enum: ["bottom", "top"], default: "bottom" },
    outward: { type: Boolean, default: true },
  },
  { collection: "model_area_springs", timestamps: true }
);

// One spring per area within a project; also serves "all springs of a project".
areaSpringSchema.index({ projectId: 1, areaId: 1 }, { unique: true });

module.exports = {
  ModelAreaSpring: model("ModelAreaSpring", areaSpringSchema),
};
