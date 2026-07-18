const { Schema, model } = require("mongoose");

// User-owned area-section catalog (reusable library, not tied to a project).
// Mirror of catalogFrameSectionModel but for area elements (walls/slabs/shells).
// Replica of SAP2000's "Shell Section Data". v1: only kind "shell".
const modifiersSchema = new Schema(
  {
    f11: { type: Number, default: 1 },
    f22: { type: Number, default: 1 },
    f12: { type: Number, default: 1 },
    m11: { type: Number, default: 1 },
    m22: { type: Number, default: 1 },
    m12: { type: Number, default: 1 },
    v13: { type: Number, default: 1 },
    v23: { type: Number, default: 1 },
    mass: { type: Number, default: 1 },
    weight: { type: Number, default: 1 },
  },
  { _id: false }
);

const catalogAreaSectionSchema = new Schema(
  {
    ownerId: { type: String, required: true }, // Clerk user id
    name: { type: String, required: true },
    kind: { type: String, enum: ["shell"], default: "shell" },
    shellType: {
      type: String,
      enum: ["shell-thin", "shell-thick", "plate-thin", "plate-thick", "membrane"],
      required: true,
    },
    materialId: {
      type: Schema.Types.ObjectId,
      ref: "CatalogMaterial",
      required: true,
    },
    materialAngle: { type: Number, default: 0 }, // degrees
    thicknessMembrane: { type: Number, required: true }, // m
    thicknessBending: { type: Number, required: true }, // m
    modifiers: { type: modifiersSchema, default: () => ({}) },
    color: { type: String }, // display color (hex)
  },
  { collection: "catalog_area_sections", timestamps: true }
);

catalogAreaSectionSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = {
  CatalogAreaSection: model("CatalogAreaSection", catalogAreaSectionSchema),
};
