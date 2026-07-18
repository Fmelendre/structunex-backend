const { Schema, model } = require("mongoose");
const { Mixed } = Schema.Types;

// Project metadata only. The structural model (nodes, elements, materials,
// sections, supports, loads) and the solver result live in their own
// collections, related by projectId. See src/models/index.js.
const projectSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, default: "E.030" }, // building code
    ownerId: { type: String, required: true }, // Clerk user id
    status: {
      type: String,
      enum: ["draft", "solving", "solved", "error"],
      default: "draft",
    },
    // Metadata del proyecto (creada desde el asistente del frontend).
    templateId: { type: String },
    // Tipo de análisis (formulación de cálculo). Inmutable una vez creado.
    analysisType: { type: String },
    dofPerNode: { type: Number },
    // Parámetros del modelo (luz, altura, apoyos...); el frontend regenera la
    // geometría desde templateId + params.
    params: { type: Mixed },
    units: { type: String },
    client: { type: String },
    company: { type: String },
    engineer: { type: String },
    description: { type: String },
  },
  { collection: "projects", timestamps: true }
);

// Serves listProjects: filter by ownerId, sorted by createdAt desc.
projectSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = { Project: model("Project", projectSchema) };
