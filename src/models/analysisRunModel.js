const { Schema, model } = require("mongoose");

// One document per analysis run. The heavy payload (displacements, member forces,
// stations, shell forces, mode shapes) lives in S3 as Parquet, written by the
// calc-service; this collection holds only what you need to list, compare and locate a
// run — and it must stay small, which is the whole point of the split.
//
// Runs are created when the job starts, so failed and cancelled attempts are on record
// too, not just the successful ones.

// A load case: its real name (user text, e.g. "Sismo X") and the slug the calc-service
// used as the S3 key. NEVER rebuild the key from the name — the slug resolves
// collisions with an ordinal, so the mapping only exists here.
const caseSchema = new Schema(
  {
    name: { type: String, required: true },
    key: { type: String, required: true },
    // "pattern" (a Load Pattern) or "responseSpectrum" (a combined seismic case). Defaults
    // to "pattern" so runs recorded before RS existed still read as ordinary cases.
    kind: { type: String, default: "pattern" },
    bytes: { type: Number, default: 0 },
    // { displacements, member_forces, stations, deflected, reactions, shell_forces }
    // → path relative to the run prefix.
    files: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

// The numbers that let the UI list and compare runs without reading a byte from S3.
const summarySchema = new Schema(
  {
    perCase: { type: Array, default: [] },
    drift: { type: Array, default: [] },
  },
  { _id: false }
);

const analysisRunSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    status: {
      type: String,
      enum: ["solving", "solved", "error", "cancelled"],
      default: "solving",
    },
    startedAt: { type: Date, default: Date.now },
    solvedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    error: { type: String, default: null },

    // Where the Parquet lives: "{prefix}/{projectId}/{runId}" inside the bucket.
    s3Prefix: { type: String, default: null },
    schemaVersion: { type: Number, default: null },

    activeDofs: { type: [String], default: [] },
    notes: { type: [String], default: [] },
    cases: { type: [caseSchema], default: [] },
    // { nodes, elements, meshNodes, shellQuads, cases, modes }
    counts: { type: Schema.Types.Mixed, default: {} },
    // Per-mode scalars (eigenvalue, frequencyHz, period); the shapes are in Parquet.
    modes: { type: Array, default: [] },
    mesh: { type: Schema.Types.Mixed, default: {} },
    modeShapes: { type: String, default: null },
    // Resortes de balasto: son rigidez, no resultado, así que se escriben una vez por
    // ejecución. null cuando el modelo no lleva resortes de área.
    springs: { type: String, default: null },
    bytes: { type: Number, default: 0 },

    // Máximos por caso y deriva entre plantas. Los calcula el calc-service y viajan en
    // el manifiesto; se guardan aquí para que la sección Analysis pinte el resumen sin
    // bajar un solo byte de Parquet.
    summary: {
      type: summarySchema,
      default: () => ({ perCase: [], drift: [] }),
    },

    // Masa, centro de masa y centro de rigidez por planta (no depende del caso de
    // carga). Igual que `modes`: el calc-service ya lo manda calculado en el
    // manifiesto, aquí solo se guarda.
    stories: { type: Array, default: [] },

    // Fingerprint of the model that was solved, so the UI can tell whether a stored
    // run still matches the geometry on screen or went stale when the user edited it.
    modelHash: { type: String, default: null },
  },
  { collection: "analysis_runs", timestamps: true, minimize: false }
);

// "the runs of this project, newest first" — the only access pattern there is.
analysisRunSchema.index({ projectId: 1, startedAt: -1 });

module.exports = { AnalysisRun: model("AnalysisRun", analysisRunSchema) };
