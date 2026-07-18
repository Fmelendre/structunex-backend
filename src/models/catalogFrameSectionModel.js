const { Schema, model } = require("mongoose");

// User-owned section catalog (reusable library, not tied to a project). A
// section is a shape made of a material that resolves to the props the solver
// consumes: A, I33, I22, J (SAP convention: I33 = strong axis). The shape is
// defined 3 ways via `source`; Zod enforces the per-source shape at the route,
// Mongoose stores the superset of fields.
const propsSchema = new Schema(
  {
    A: { type: Number, required: true },
    I33: { type: Number, required: true },
    I22: { type: Number },
    J: { type: Number },
  },
  { _id: false }
);

const modifiersSchema = new Schema(
  {
    area: { type: Number, default: 1 },
    i33: { type: Number, default: 1 },
    i22: { type: Number, default: 1 },
    j: { type: Number, default: 1 },
  },
  { _id: false }
);

const catalogFrameSectionSchema = new Schema(
  {
    ownerId: { type: String, required: true }, // Clerk user id
    name: { type: String, required: true },
    materialId: { type: Schema.Types.ObjectId, ref: "CatalogMaterial", required: true },
    source: {
      type: String,
      enum: ["catalog", "parametric", "general"],
      required: true,
    },
    // Definición por source
    catalogLabel: { type: String }, // catalog
    shape: {
      type: String,
      enum: [
        "rectangular",
        "circular",
        "pipe",
        "box",
        "ishape",
        "channel",
        "tee",
        "angle",
      ],
    }, // parametric
    // Cotas paramétricas (superset; la forma la garantiza Zod)
    b: { type: Number }, // rectangular / box / angle
    h: { type: Number }, // rectangular / box
    d: { type: Number }, // circular / pipe / box(no) ; también depth en I/C/T/L
    t: { type: Number }, // pipe / box / angle
    tw: { type: Number }, // ishape / channel / tee
    tf: { type: Number }, // channel / tee
    bf: { type: Number }, // channel / tee
    bfTop: { type: Number }, // ishape
    tfTop: { type: Number }, // ishape
    bfBot: { type: Number }, // ishape
    tfBot: { type: Number }, // ishape
    // general: A/I33/I22/J de entrada
    A: { type: Number },
    I33: { type: Number },
    I22: { type: Number },
    J: { type: Number },
    // Props resueltas (las que lee el solver) y modificadores
    props: { type: propsSchema, required: true },
    modifiers: { type: modifiersSchema, default: () => ({}) },
    color: { type: String }, // display color (hex)
  },
  { collection: "catalog_frame_sections", timestamps: true }
);

catalogFrameSectionSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = {
  CatalogFrameSection: model("CatalogFrameSection", catalogFrameSectionSchema),
};
