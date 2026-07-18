// Backfill de `propertyType` en las secciones de barra existentes.
//
// Antes, la sección no tenía tipo propio: heredaba implícitamente el del
// material. Este script asigna `propertyType` a cada sección que aún no lo
// tiene, derivándolo del `type` del material referenciado:
//   material.type "concrete" -> "concrete"
//   material.type "steel"    -> "steel"
//   resto (rebar/other/sin material) -> "other"
//
// Idempotente: solo toca documentos sin `propertyType`. No añade armado (eso se
// define a mano en el diálogo de secciones).
//
// Uso:  node scripts/backfillSectionPropertyType.js
//       node scripts/backfillSectionPropertyType.js --dry-run

const { connectDb, disconnectDb } = require("../src/config/db");
const { CatalogFrameSection, CatalogMaterial } = require("../src/models");

const DRY_RUN = process.argv.includes("--dry-run");

function derive(materialType) {
  if (materialType === "concrete") return "concrete";
  if (materialType === "steel") return "steel";
  return "other";
}

async function main() {
  await connectDb();

  const sections = await CatalogFrameSection.find({
    propertyType: { $exists: false },
  })
    .select("_id name materialId")
    .lean();

  if (sections.length === 0) {
    console.log("[backfill] Nada que migrar: todas las secciones ya tienen propertyType.");
    return;
  }

  // Tipo de cada material referenciado (una sola consulta).
  const materialIds = [...new Set(sections.map((s) => String(s.materialId)))];
  const materials = await CatalogMaterial.find({ _id: { $in: materialIds } })
    .select("type")
    .lean();
  const typeById = new Map(materials.map((m) => [String(m._id), m.type]));

  let updated = 0;
  const summary = { steel: 0, concrete: 0, other: 0 };
  for (const s of sections) {
    const propertyType = derive(typeById.get(String(s.materialId)));
    summary[propertyType] += 1;
    console.log(
      `[backfill] ${s.name} (${s._id}) -> ${propertyType}` +
        (DRY_RUN ? "  [dry-run]" : "")
    );
    if (!DRY_RUN) {
      await CatalogFrameSection.updateOne({ _id: s._id }, { $set: { propertyType } });
      updated += 1;
    }
  }

  console.log(
    `[backfill] ${DRY_RUN ? "Se migrarían" : "Migradas"} ${
      DRY_RUN ? sections.length : updated
    } secciones ` + `(steel: ${summary.steel}, concrete: ${summary.concrete}, other: ${summary.other}).`
  );
}

main()
  .catch((err) => {
    console.error("[backfill] Error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb();
  });
