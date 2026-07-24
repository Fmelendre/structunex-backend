const { Schema, model } = require("mongoose");

// Solver output for a project. One result per project (1:1). The condition-based
// engine returns one result set per Load Pattern, so `patterns` is the array of
// { pattern, nodeResults, elementForces, reactions, deflectedShape }. `activeDofs`
// records the DOF condition the run used. Loose Array/Mixed typing: the shape is
// owned by the calc-service contract, not re-declared here.
const resultSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true,
    },
    patterns: { type: Array, default: [] },
    activeDofs: { type: [String], default: [] },
    notes: { type: [String], default: [] },
    solvedAt: { type: String },
    // Auto-mesh of the areas (synthetic nodes, CQUAD4s, subdivided boundary beams) and
    // the modal results. Every field of the calc-service contract MUST be declared here:
    // Mongoose is strict by default and silently drops anything it does not know, and
    // this document is what the client reads back from GET /analysis - so a missing
    // field simply disappears from the UI (no mesh, no modes) with no error anywhere.
    meshAreas: { type: Schema.Types.Mixed, default: undefined },
    modes: { type: Array, default: [] },
    // Grounded springs (node, DOF, which way compresses). The client tests slab
    // uplift on its load combinations with these; dropped here, that check would
    // silently never fire.
    springs: { type: Array, default: [] },
  },
  { collection: "results", timestamps: true, minimize: false }
);

module.exports = { Result: model("Result", resultSchema) };
