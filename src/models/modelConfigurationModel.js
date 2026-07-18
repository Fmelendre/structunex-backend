const { Schema, model } = require("mongoose");

// Non-geometry configuration of a project's structural model: one document per
// project. Holds the grid system (SAP "Define Grid System Data") and the
// defaults applied to newly drawn entities. Persists independently of geometry,
// so a project with only a grid defined (no nodes yet) is still saved.
const gridLineSchema = new Schema(
  {
    id: { type: String, required: true }, // bubble id ("A", "1", "Z0"…)
    ordinate: { type: Number, required: true },
  },
  { _id: false }
);

const gridSystemSchema = new Schema(
  {
    x: { type: [gridLineSchema], default: [] },
    y: { type: [gridLineSchema], default: [] },
    z: { type: [gridLineSchema], default: [] },
  },
  { _id: false }
);

// Load Patterns (Define → Load Patterns, estilo SAP2000). Contenedores de carga
// con nombre + tipo + multiplicador de peso propio.
const loadPatternSchema = new Schema(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["dead", "superDead", "live", "wind", "snow", "quake", "other"],
      default: "dead",
    },
    selfWeightMultiplier: { type: Number, default: 0 },
  },
  { _id: false }
);

const modelConfigurationSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true, // one configuration document per project
    },
    gridSystem: { type: gridSystemSchema, default: null },
    loadPatterns: { type: [loadPatternSchema], default: [] },
    // Defaults aplicados a lo que se dibuja (referencian el catálogo). Se
    // consumen en la Etapa B (elementos/áreas referencian el catálogo).
    defaultFrameSectionId: { type: String, default: null },
    defaultAreaSectionId: { type: String, default: null },
  },
  { collection: "model_configuration", timestamps: true }
);

module.exports = {
  ModelConfiguration: model("ModelConfiguration", modelConfigurationSchema),
};
