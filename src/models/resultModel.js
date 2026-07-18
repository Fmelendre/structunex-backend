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
  },
  { collection: "results", timestamps: true, minimize: false }
);

module.exports = { Result: model("Result", resultSchema) };
