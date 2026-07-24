const { Project } = require("./projectModel");
const { ModelNode } = require("./modelNodeModel");
const { ModelElement } = require("./modelElementModel");
const { ModelSupport } = require("./modelSupportModel");
const { ModelLoad } = require("./modelLoadModel");
const { ModelArea } = require("./modelAreaModel");
const { ModelFrameLoad } = require("./modelFrameLoadModel");
const { ModelAreaLoad } = require("./modelAreaLoadModel");
const { ModelAreaSpring } = require("./modelAreaSpringModel");
const { ModelConfiguration } = require("./modelConfigurationModel");
const { Result } = require("./resultModel");
const { CatalogMaterial } = require("./catalogMaterialModel");
const { CatalogFrameSection } = require("./catalogFrameSectionModel");
const { CatalogAreaSection } = require("./catalogAreaSectionModel");

// Maps each key of the nested `model` payload to its collection. The service
// iterates this to split on write, assemble on read, and clean up on delete —
// so adding an entity type means adding one line here. Materials and sections
// are NOT model collections: elements/areas reference the user catalogs
// (CatalogFrameSection / CatalogAreaSection) directly.
const CHILD_MODELS = [
  { key: "nodes", Model: ModelNode },
  { key: "elements", Model: ModelElement },
  { key: "supports", Model: ModelSupport },
  { key: "loads", Model: ModelLoad },
  { key: "areas", Model: ModelArea },
  { key: "frameLoads", Model: ModelFrameLoad },
  { key: "areaLoads", Model: ModelAreaLoad },
  { key: "areaSprings", Model: ModelAreaSpring },
];

module.exports = {
  Project,
  ModelNode,
  ModelElement,
  ModelSupport,
  ModelLoad,
  ModelArea,
  ModelFrameLoad,
  ModelAreaLoad,
  ModelAreaSpring,
  ModelConfiguration,
  Result,
  CatalogMaterial,
  CatalogFrameSection,
  CatalogAreaSection,
  CHILD_MODELS,
};
