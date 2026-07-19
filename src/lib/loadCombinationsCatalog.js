// Catálogo de combinaciones de carga de diseño (ASCE 7 acero LRFD/ASD + ACI
// 318), servido desde JSON en memoria como el catálogo AISC: actualizar el
// catálogo = reemplazar el JSON, sin DB ni seed.
const catalog = require("../data/load_combinations.json");

module.exports = { getCatalog: () => catalog };
