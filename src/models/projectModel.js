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
    // Live progress of the running analysis (see services/analysisJob.js). The frontend
    // polls GET /projects/:id/analysis and renders `step` + `message`; `current`/`total`
    // only mean something for the per-load-pattern loop. `updatedAt` doubles as the
    // heartbeat that lets us spot a run orphaned by a dyno restart.
    analysisProgress: {
      type: new Schema(
        {
          step: { type: String },
          message: { type: String },
          current: { type: Number },
          total: { type: Number },
          updatedAt: { type: Date },
        },
        { _id: false }
      ),
      default: undefined,
    },
    // Why the last run failed (or that it was cancelled). Kept apart from `status` so a
    // failed re-run can leave the previous results in place and still report the reason.
    analysisError: { type: String, default: null },
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
