const { Schema, model } = require("mongoose");

// A structural element (bar/frame) joins two nodes and references a frame
// section from the user's catalog (CatalogFrameSection, which carries its
// material). frameSectionId is optional: a bar can be drawn before a section is
// assigned.
const elementSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    id: { type: String, required: true },
    nodeA: { type: String, required: true },
    nodeB: { type: String, required: true },
    frameSectionId: { type: String }, // CatalogFrameSection _id (optional)
    roll: { type: Number, default: 0 }, // section orientation angle (degrees)
  },
  { collection: "model_elements", timestamps: true }
);

elementSchema.index({ projectId: 1, id: 1 }, { unique: true });

module.exports = { ModelElement: model("ModelElement", elementSchema) };
