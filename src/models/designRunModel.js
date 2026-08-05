const { Schema, model } = require("mongoose");

// Una ejecución de COMPROBACIÓN por normativa. Espejo de `analysisRunModel`: el grueso
// (ratios por barra, criterios, curvas de interacción) vive en S3 como Parquet y aquí
// solo queda lo que hace falta para listar, comparar y localizar la ejecución.
//
// Es un documento propio y no un campo de `AnalysisRun` porque el diseño se relanza sin
// volver a analizar: un mismo análisis puede tener varias comprobaciones encima —con
// otro armado, con otra normativa— y cada una necesita su historial.

const designCombosField = { type: [String], default: [] };

// Los tres números que resumen una comprobación. Se guardan aquí para que la lista de
// ejecuciones y el aviso de "hay barras que no pasan" salgan sin bajar Parquet.
const summarySchema = new Schema(
  {
    maxRatio: { type: Number, default: 0 },
    maxRatioElement: { type: String, default: null },
    maxRatioCombo: { type: String, default: null },
  },
  { _id: false }
);

const designRunSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    // De qué análisis salieron los esfuerzos. Sin él la comprobación no se puede
    // interpretar: los mismos ratios sobre otro análisis significan otra cosa.
    analysisRunId: {
      type: Schema.Types.ObjectId,
      ref: "AnalysisRun",
      required: true,
    },
    status: {
      type: String,
      enum: ["designing", "done", "error", "cancelled"],
      default: "designing",
    },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    error: { type: String, default: null },

    // Normativas con las que se comprobó. Van en el documento y no solo en el
    // manifiesto porque son lo primero que se mira al elegir una ejecución del historial.
    code: { type: String, default: null },
    steelCode: { type: String, default: null },
    combos: designCombosField,

    s3Prefix: { type: String, default: null },
    schemaVersion: { type: Number, default: null },
    // { members, criteria, stations, interaction, messages } → ruta relativa al prefijo.
    files: { type: Schema.Types.Mixed, default: {} },
    // { elements, checked, overstressed, unchecked, combos }
    counts: { type: Schema.Types.Mixed, default: {} },
    notes: { type: [String], default: [] },
    bytes: { type: Number, default: 0 },
    summary: { type: summarySchema, default: () => ({}) },
  },
  { collection: "design_runs", timestamps: true, minimize: false }
);

// "las comprobaciones de este proyecto, de la más reciente a la más antigua".
designRunSchema.index({ projectId: 1, startedAt: -1 });

module.exports = { DesignRun: model("DesignRun", designRunSchema) };
