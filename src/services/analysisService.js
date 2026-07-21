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
  CatalogAreaSection,
  CatalogMaterial,
} = require("../models");
const { AppError } = require("../middleware/errorHandler");
const analysisJob = require("./analysisJob");

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

  // Areas reference a CatalogAreaSection (shell: thickness + material). Expand it the
  // same way as frame sections so meshed shells get their stiffness. Areas without a
  // valid section pass through unmeshed (the calc-service lumps their load to corners).
  const areaSectionIds = [
    ...new Set(
      areas
        .map((a) => a.areaSectionId)
        .filter((id) => id && mongoose.isValidObjectId(id))
        .map(String)
    ),
  ];
  const catAreaSections = areaSectionIds.length
    ? await CatalogAreaSection.find({ _id: { $in: areaSectionIds } }).lean()
    : [];

  // Materials come from BOTH frame and area sections (union), so shell materials land
  // in the same flat list the engine consumes.
  const materialIds = [
    ...new Set(
      [...catSections, ...catAreaSections]
        .map((s) => String(s.materialId))
        .filter((id) => mongoose.isValidObjectId(id))
    ),
  ];
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

  // Engine area sections: { id, materialId, shellType, thicknessMembrane,
  // thicknessBending, modifiers }. Thicknesses are already stored in metres; the
  // calc-service meshes each area into CQUAD4 shells against this section.
  const areaSections = catAreaSections.map((s) => ({
    id: String(s._id),
    materialId: String(s.materialId),
    shellType: s.shellType,
    thicknessMembrane: s.thicknessMembrane,
    thicknessBending: s.thicknessBending,
    modifiers: s.modifiers || {},
  }));

  // Bars reference their section by the catalog _id (the section carries material).
  const solverElements = assigned
    .filter((e) => sectionById.has(String(e.frameSectionId)))
    .map((e) => ({
      id: e.id,
      nodeA: e.nodeA,
      nodeB: e.nodeB,
      sectionId: String(e.frameSectionId),
      roll: e.roll != null ? e.roll : 0, // section orientation angle (degrees)
      // End releases (SAP2000 "Frame Releases"); omitted => fixed ends.
      ...(e.releases ? { releases: e.releases } : {}),
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
    // Defensa por datos antiguos: el calc-service exige loadPattern en cada carga
    // nodal (y una carga sin patrón no se aplicaría a ningún caso). Descartamos las
    // que no lo tengan para no provocar un 422.
    loads: loads.filter((l) => l.loadPattern),
    // Only loads on bars that made it into the model (have a section).
    frameLoads: frameLoads.filter((fl) => assignedIds.has(fl.elementId)),
    areas,
    areaLoads,
    areaSections,
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

  // One config read for load patterns + the modal inputs (Mass Source, Modal cases).
  // SAP-style single Run: the calc-service also solves modes when modalCases is present.
  const config = await ModelConfiguration.findOne({ projectId })
    .select("loadPatterns massSource modalCases")
    .lean();

  let loadPatterns = Array.isArray(opts.loadPatterns) ? opts.loadPatterns : null;
  if (!loadPatterns) loadPatterns = (config && config.loadPatterns) || [];
  loadPatterns = loadPatterns.map((p) => ({
    name: p.name,
    type: p.type || "dead",
    selfWeightMultiplier: p.selfWeightMultiplier != null ? p.selfWeightMultiplier : 0,
  }));

  const massSource = (config && config.massSource) || null;
  const modalCases = (config && config.modalCases) || [];

  return { analysisOptions: { activeDofs, loadPatterns }, massSource, modalCases };
}

// Runs the calculation for an already-authorized project (loaded by
// loadProject). `options` is the request body's analysisOptions (the condition).
// The HTTP call to the solver stays outside any transaction.
// Starts the analysis and returns as soon as the job is queued - the solve itself runs
// in the background (analysisJob) and reports progress through the project document.
// Blocking here would be worse than slow: Heroku's router aborts any request without a
// response within 30 s, so a long solve could never finish over a synchronous call.
async function run(project, options) {
  const projectId = project._id;

  // Assemble everything the solver needs BEFORE going async, so a bad model still fails
  // as a normal 4xx on this request instead of surfacing later as a job error.
  const { analysisOptions, massSource, modalCases } = await resolveOptions(
    projectId,
    options
  );
  const model = await assembleModel(projectId);

  await analysisJob.start(projectId, {
    analysisOptions,
    model,
    massSource,
    modalCases,
  });

  return {
    status: "solving",
    progress: {
      step: "preparing",
      message: `Preparando modelo · ${model.nodes.length} nudos, ${model.elements.length} barras, ${model.areas.length} áreas`,
    },
  };
}

// A run whose progress stopped moving this long ago is orphaned: the web dyno was
// restarted (deploy, routine cycling) while the job was in flight.
const STALE_MS = 5 * 60 * 1000;

// Current analysis state + live progress + last result for a project.
async function get(projectId) {
  const [project, result] = await Promise.all([
    Project.findById(projectId)
      .select("status analysisProgress analysisError")
      .lean(),
    Result.findOne({ projectId })
      .select("-_id -projectId -__v -createdAt -updatedAt")
      .lean(),
  ]);
  if (!project) return { status: null, progress: null, error: null, result: null };

  const progress = project.analysisProgress || null;

  // Orphaned run: nothing in this process is driving it any more, so stop reporting
  // "solving" forever and let the user relaunch.
  const stale =
    project.status === "solving" &&
    !analysisJob.isRunning(projectId) &&
    (!progress ||
      !progress.updatedAt ||
      Date.now() - new Date(progress.updatedAt).getTime() > STALE_MS);
  if (stale) {
    const message = "El análisis se interrumpió (el servidor se reinició). Vuelve a lanzarlo.";
    await analysisJob.settleFailure(projectId, message).catch(() => {});
    return {
      status: result ? "solved" : "draft",
      progress: null,
      error: message,
      result: result || null,
    };
  }

  return {
    status: project.status,
    progress,
    error: project.analysisError || null,
    result: result || null,
  };
}

// Hangs up on the calc-service; it notices the disconnect and kills MYSTRAN. Previous
// results are left untouched (see analysisJob.settleFailure).
function cancel(projectId) {
  return analysisJob.cancel(projectId);
}

module.exports = { run, get, cancel, assembleModel };
