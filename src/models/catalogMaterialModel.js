const { Schema, model } = require("mongoose");

// User-owned material catalog (reusable library, not tied to a project). The
// shape per `type` is enforced by Zod at the route; Mongoose stores the superset
// of fields. G is derived on the client from (E, nu) and never stored.
const catalogMaterialSchema = new Schema(
  {
    ownerId: { type: String, required: true }, // Clerk user id
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["concrete", "steel", "rebar", "other"],
      required: true,
      default: "steel",
    },
    // Análisis (rigidez)
    E: { type: Number, required: true }, // módulo de Young (kPa)
    nu: { type: Number, required: true }, // Poisson
    density: { type: Number }, // peso por volumen (kN/m³)
    alpha: { type: Number }, // coef. dilatación térmica
    // Diseño — hormigón
    fc: { type: Number }, // f'c (kPa)
    fcExpected: { type: Number },
    lightweight: { type: Boolean, default: false },
    lambda: { type: Number },
    // Diseño — acero / armadura
    Fy: { type: Number },
    Fu: { type: Number },
    Fye: { type: Number },
    Fue: { type: Number },
    color: { type: String }, // display color (hex)
  },
  { collection: "catalog_materials", timestamps: true }
);

catalogMaterialSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = {
  CatalogMaterial: model("CatalogMaterial", catalogMaterialSchema),
};
