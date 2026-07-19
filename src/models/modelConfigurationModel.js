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
      enum: [
        "dead",
        "superDead",
        "live",
        "roofLive",
        "wind",
        "snow",
        "rain",
        "quake",
        "other",
      ],
      default: "dead",
    },
    selfWeightMultiplier: { type: Number, default: 0 },
  },
  { _id: false }
);

// Load Combinations (Define → Load Combinations, estilo SAP2000): suma lineal
// de patrones con factor. `pattern` referencia loadPatterns[].name.
const comboFactorSchema = new Schema(
  {
    pattern: { type: String, required: true },
    factor: { type: Number, required: true },
  },
  { _id: false }
);

const loadCombinationSchema = new Schema(
  {
    name: { type: String, required: true },
    factors: { type: [comboFactorSchema], default: [] },
  },
  { _id: false }
);

// Mass Source (Define → Mass Source, estilo SAP2000): de dónde sale la masa
// para el futuro análisis modal — peso propio de elementos y/o patrones de
// carga convertidos a masa con multiplicador. Un único mass source por
// proyecto; null = default implícito (solo peso propio).
const massMultiplierSchema = new Schema(
  {
    pattern: { type: String, required: true },
    multiplier: { type: Number, required: true },
  },
  { _id: false }
);

const massSourceSchema = new Schema(
  {
    name: { type: String, required: true },
    elementSelfMass: { type: Boolean, default: true },
    specifiedLoadPatterns: { type: Boolean, default: false },
    multipliers: { type: [massMultiplierSchema], default: [] },
  },
  { _id: false }
);

// Load Cases tipo Modal (Define → Load Cases, estilo SAP2000). Los casos
// "Linear Static" se derivan de loadPatterns y no se persisten aquí.
const modalCaseSchema = new Schema(
  {
    name: { type: String, required: true },
    typeOfModes: {
      type: String,
      enum: ["eigen", "ritz"],
      default: "eigen",
    },
    maxModes: { type: Number, default: 12 },
    minModes: { type: Number, default: 1 },
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
    loadCombinations: { type: [loadCombinationSchema], default: [] },
    massSource: { type: massSourceSchema, default: null },
    modalCases: { type: [modalCaseSchema], default: [] },
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
