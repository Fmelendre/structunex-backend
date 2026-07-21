const { Schema, model } = require("mongoose");

// Released components at ONE end of a frame, in its local axes (SAP2000 names):
// P axial, V2/V3 shears, T torsion, M2/M3 bending. true = the member transmits
// nothing for that component there (a hinge).
const endReleasesSchema = new Schema(
  {
    p: { type: Boolean, default: false },
    v2: { type: Boolean, default: false },
    v3: { type: Boolean, default: false },
    t: { type: Boolean, default: false },
    m2: { type: Boolean, default: false },
    m3: { type: Boolean, default: false },
  },
  { _id: false }
);

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
    // End releases (SAP2000 "Assign > Frame > Releases"). `i` = start end (nodeA),
    // `j` = end (nodeB). Absent => both ends fully fixed.
    releases: {
      type: new Schema(
        { i: { type: endReleasesSchema }, j: { type: endReleasesSchema } },
        { _id: false }
      ),
      default: undefined,
    },
  },
  { collection: "model_elements", timestamps: true }
);

elementSchema.index({ projectId: 1, id: 1 }, { unique: true });

module.exports = { ModelElement: model("ModelElement", elementSchema) };
