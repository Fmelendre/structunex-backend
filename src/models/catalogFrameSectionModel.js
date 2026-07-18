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

// Armado (solo secciones de hormigón). Superset de campos viga+columna; la
// forma coherente por `designRole` la garantiza Zod en la ruta. No lo consume
// el solver: es dato de diseño, latente hasta que exista el módulo de
// verificación.
const reinforcementSchema = new Schema(
  {
    designRole: { type: String, enum: ["beam", "column"], required: true },
    rebarMaterialId: { type: Schema.Types.ObjectId, ref: "CatalogMaterial" },
    cover: { type: Number, required: true }, // recubrimiento libre (m)
    // Columna
    pattern: { type: String, enum: ["rectangular", "circular"] },
    longBarDia: { type: Number }, // diámetro barra longitudinal (m)
    numBars3: { type: Number }, // barras en la cara local 3 (rectangular)
    numBars2: { type: Number }, // barras en la cara local 2 (rectangular)
    numBarsCirc: { type: Number }, // barras totales (circular)
    tieBarDia: { type: Number }, // diámetro del cerco/estribo (m)
    tieSpacing: { type: Number }, // separación de cercos (m)
    confinement: { type: String, enum: ["ties", "spiral"] },
    // Viga
    coverTop: { type: Number },
    coverBot: { type: Number },
  },
  { _id: false }
);

const catalogFrameSectionSchema = new Schema(
  {
    ownerId: { type: String, required: true }, // Clerk user id
    name: { type: String, required: true },
    materialId: { type: Schema.Types.ObjectId, ref: "CatalogMaterial", required: true },
    // Tipo de propiedad (estilo SAP): condiciona material, formas y armado.
    // Debe ser coherente con el `type` del material referenciado.
    propertyType: {
      type: String,
      enum: ["steel", "concrete", "other"],
      required: true,
      default: "steel",
    },
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
    // Armado (solo hormigón; se limpia al cambiar de tipo)
    reinforcement: { type: reinforcementSchema },
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
