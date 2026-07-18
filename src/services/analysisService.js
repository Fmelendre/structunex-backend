const mongoose = require("mongoose");
const {
  Project,
  Result,
  ModelNode,
  ModelElement,
  ModelSupport,
  ModelLoad,
  ModelArea,
  ModelFrameLoad,
  ModelAreaLoad,
  ModelConfiguration,
  CatalogFrameSection,
  CatalogMaterial,
} = require("../models");
const { AppError } = require("../middleware/errorHandler");
const { analyzeModel } = require("./calcService");

const ALL_DOFS = ["UX", "UY", "UZ", "RX", "RY", "RZ"];

// Builds the v2 payload the condition-based engine (POST /analyze) expects. The
// model geometry is read from the project's collections (autosaved by the
// frontend); the *conditions* (activeDofs + load patterns) come from the request.
//
// Materials and sections are not stored per-project: bars reference a
// CatalogFrameSection (which carries its material), so we expand those catalog
// docs into the flat { materials, sections } the engine consumes. Convention
// (SAP): I33 = strong axis -> Iy, I22 = weak -> Iz. Stiffness modifiers applied.
// Bars without an assigned section can't be solved and are omitted. Areas carry
// no stiffness (v1): they pass through only to lump their surface loads to the
// boundary nodes.
async function assembleModel(projectId) {
  const [nodes, elements, supports, loads, areas, frameLoads, areaLoads] =
    await Promise.all([
      ModelNode.find({ projectId }).select("-_id -projectId -__v -createdAt -updatedAt").lean(),
      ModelElement.find({ projectId }).select("-_id -projectId -__v -createdAt -updatedAt").lean(),
      ModelSupport.find({ projectId }).select("-_id -projectId -__v -createdAt -updatedAt").lean(),
      ModelLoad.find({ projectId }).select("-_id -projectId -__v -createdAt -updatedAt").lean(),
      ModelArea.find({ projectId }).select("-_id -projectId -__v -createdAt -updatedAt").lean(),
      ModelFrameLoad.find({ projectId }).select("-_id -projectId -__v -createdAt -updatedAt").lean(),
      ModelAreaLoad.find({ projectId }).select("-_id -projectId -__v -createdAt -updatedAt").lean(),
    ]);

  const assigned = elements.filter(
    (e) => e.frameSectionId && mongoose.isValidObjectId(e.frameSectionId)
  );
  const sectionIds = [...new Set(assigned.map((e) => String(e.frameSectionId)))];

  const catSections = sectionIds.length
    ? await CatalogFrameSection.find({ _id: { $in: sectionIds } }).lean()
    : [];
  const sectionById = new Map(catSections.map((s) => [String(s._id), s]));

  const materialIds = [...new Set(catSections.map((s) => String(s.materialId)))].filter(
    (id) => mongoose.isValidObjectId(id)
  );
  const catMaterials = materialIds.length
    ? await CatalogMaterial.find({ _id: { $in: materialIds } }).lean()
    : [];

  // Engine materials: { id, E, G, density }. G derived from E and nu if absent;
  // density (kN/m^3) drives self weight.
  const materials = catMaterials.map((m) => ({
    id: String(m._id),
    E: m.E,
    G: m.G != null ? m.G : m.E / (2 * (1 + (m.nu != null ? m.nu : 0.3))),
    density: m.density != null ? m.density : 0,
  }));

  // Engine sections: { id, materialId, A, Iy, Iz, J } with modifiers applied.
  const sections = catSections.map((s) => {
    const p = s.props || {};
    const mod = s.modifiers || {};
    return {
      id: String(s._id),
      materialId: String(s.materialId),
      A: (p.A || 0) * (mod.area != null ? mod.area : 1),
      Iy: (p.I33 || 0) * (mod.i33 != null ? mod.i33 : 1),
      Iz: (p.I22 || 0) * (mod.i22 != null ? mod.i22 : 1),
      J: (p.J || 0) * (mod.j != null ? mod.j : 1),
    };
  });

  // Bars reference their section by the catalog _id (the section carries material).
  const solverElements = assigned
    .filter((e) => sectionById.has(String(e.frameSectionId)))
    .map((e) => ({
      id: e.id,
      nodeA: e.nodeA,
      nodeB: e.nodeB,
      sectionId: String(e.frameSectionId),
    }));

  const assignedIds = new Set(solverElements.map((e) => e.id));

  // Guard: hay barras dibujadas pero ninguna llega al solver porque su sección
  // no está asignada o ya no existe en el catálogo (p. ej. tras renombrar/borrar
  // secciones). Sin barras el modelo es un mecanismo → error confuso. Avisamos
  // con un mensaje accionable en vez de dejar que reviente como "inestable".
  if (elements.length > 0 && solverElements.length === 0) {
    throw new AppError(
      422,
      `Ninguna de las ${elements.length} barra(s) tiene una sección válida ` +
        `asignada (o su sección ya no existe en el catálogo). Selecciona las ` +
        `barras y asígnales una sección antes de analizar.`
    );
  }

  return {
    nodes,
    materials,
    sections,
    elements: solverElements,
    supports,
    loads,
    // Only loads on bars that made it into the model (have a section).
    frameLoads: frameLoads.filter((fl) => assignedIds.has(fl.elementId)),
    areas,
    areaLoads,
  };
}

// Normalizes the analysisOptions from the request body against the project's
// stored configuration. activeDofs defaults to a full space frame; load patterns
// fall back to the project's Define -> Load Patterns.
async function resolveOptions(projectId, options) {
  const opts = options || {};
  let activeDofs = Array.isArray(opts.activeDofs)
    ? opts.activeDofs.filter((d) => ALL_DOFS.includes(d))
    : [];
  if (activeDofs.length === 0) activeDofs = [...ALL_DOFS];

  let loadPatterns = Array.isArray(opts.loadPatterns) ? opts.loadPatterns : null;
  if (!loadPatterns) {
    const config = await ModelConfiguration.findOne({ projectId })
      .select("loadPatterns")
      .lean();
    loadPatterns = (config && config.loadPatterns) || [];
  }
  loadPatterns = loadPatterns.map((p) => ({
    name: p.name,
    type: p.type || "dead",
    selfWeightMultiplier: p.selfWeightMultiplier != null ? p.selfWeightMultiplier : 0,
  }));

  return { activeDofs, loadPatterns };
}

// Runs the calculation for an already-authorized project (loaded by
// loadProject). `options` is the request body's analysisOptions (the condition).
// The HTTP call to the solver stays outside any transaction.
async function run(project, options) {
  const projectId = project._id;
  project.status = "solving";
  await project.save();

  try {
    const analysisOptions = await resolveOptions(projectId, options);
    const model = await assembleModel(projectId);
    const result = await analyzeModel({ analysisOptions, model });

    await Result.findOneAndUpdate(
      { projectId },
      { $set: { ...result, projectId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    project.status = "solved";
    await project.save();
    return result;
  } catch (err) {
    project.status = "error";
    await project.save();
    if (err instanceof AppError) throw err;
    throw new AppError(502, "Calc service failed to solve the model");
  }
}

// Current analysis state + last result for a project.
async function get(projectId) {
  const [project, result] = await Promise.all([
    Project.findById(projectId).select("status").lean(),
    Result.findOne({ projectId })
      .select("-_id -projectId -__v -createdAt -updatedAt")
      .lean(),
  ]);
  return { status: project ? project.status : null, result: result || null };
}

module.exports = { run, get, assembleModel };
