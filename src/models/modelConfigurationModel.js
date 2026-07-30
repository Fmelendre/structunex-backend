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

// Diafragmas rígidos con nombre (Assign ▸ Área ▸ Diafragma, estilo SAP2000
// "Diaphragm constraint"). Aquí viven solo las definiciones; la asignación es el
// campo `diaphragm` de cada área, que referencia este `name` — igual que las
// cargas referencian loadPatterns[].name.
const diaphragmSchema = new Schema(
  {
    name: { type: String, required: true },
  },
  { _id: false }
);

// Load Combinations (Define → Load Combinations, estilo SAP2000): suma lineal
// de términos con factor. Un término es O BIEN `pattern` (referencia
// loadPatterns[].name, término estático) O BIEN `seismic:true` (marcador del
// término sísmico). El marcador NO guarda un nombre: se resuelve a los casos
// Response Spectrum del proyecto por tipo, así renombrar el caso RS no rompe el combo.
const comboFactorSchema = new Schema(
  {
    pattern: { type: String },
    seismic: { type: Boolean },
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

// Función de espectro de respuesta (Define ▸ Funciones ▸ Espectro de
// respuesta). Se guardan los parámetros normativos, no la curva: el cliente la
// regenera desde el catálogo de normas (GET /seismic-codes), de modo que
// almacenarla solo la dejaría desincronizada.
//
// `source` y `params` son OPACOS a propósito: esta capa nunca usa esos
// parámetros, solo los guarda y los devuelve. Quien valida es el generador de
// cada norma en el cliente. Gracias a eso, añadir una norma no toca este
// archivo — antes había un sub-schema por norma y era el cuello de botella.
const spectrumFunctionSchema = new Schema(
  {
    name: { type: String, required: true },
    // Id de una entrada del registro de fuentes del frontend.
    source: { type: String, default: "covenin1756" },
    // Amortiguamiento al que la norma tabula la curva; las tres usan 5%.
    damping: { type: Number, default: 0.05 },
    params: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

// Casos de carga tipo Response Spectrum (Define → Casos de carga). La función
// de espectro y el caso modal se referencian por NOMBRE, igual que las cargas
// referencian loadPatterns[].name.
const spectrumLoadRowSchema = new Schema(
  {
    direction: { type: String, enum: ["UX", "UY", "UZ"], required: true },
    function: { type: String, required: true },
    scaleFactor: { type: Number, default: 1 },
  },
  { _id: false }
);

const responseSpectrumCaseSchema = new Schema(
  {
    name: { type: String, required: true },
    modalCase: { type: String, required: true },
    loads: { type: [spectrumLoadRowSchema], default: [] },
    modalCombination: { type: String, enum: ["CQC", "SRSS"], default: "CQC" },
    directionalCombination: {
      type: String,
      enum: ["SRSS", "ABS"],
      default: "SRSS",
    },
    // El del CQC, no el de la curva: la función guarda el suyo aparte.
    modalDamping: { type: Number, default: 0.05 },
    diaphragmEccentricity: { type: Number, default: 0 },
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
    diaphragms: { type: [diaphragmSchema], default: [] },
    spectrumFunctions: { type: [spectrumFunctionSchema], default: [] },
    responseSpectrumCases: { type: [responseSpectrumCaseSchema], default: [] },
    // GDL disponibles elegidos por el usuario (Analizar → Opciones de análisis,
    // estilo SAP2000 "Available DOFs"). null = automático: se deducen de la
    // formulación del proyecto y, a falta de ella, de la geometría.
    activeDofs: {
      type: [String],
      enum: ["UX", "UY", "UZ", "RX", "RY", "RZ"],
      default: null,
    },
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
