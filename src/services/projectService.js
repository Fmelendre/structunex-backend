const mongoose = require("mongoose");
const { Project, Result, ModelConfiguration, CHILD_MODELS } = require("../models");

// Project metadata only. The structural model lives in the child collections
// and is managed through the per-entity sub-resource routes. Ownership is
// enforced upstream by loadProject, so operations that already received a
// loaded project (update/remove) don't re-check it here.

function createProject({
  name,
  code,
  ownerId,
  templateId,
  params,
  analysisType,
  dofPerNode,
  units,
  client,
  company,
  engineer,
  description,
}) {
  return Project.create({
    name,
    code,
    ownerId,
    templateId,
    params,
    analysisType,
    dofPerNode,
    units,
    client,
    company,
    engineer,
    description,
  });
}

// Metadata only — never loads the model. That's the point of normalizing.
function listProjects(ownerId) {
  return Project.find({ ownerId }).sort({ createdAt: -1 }).lean();
}

// project was loaded + authorized by loadProject; apply metadata changes.
async function updateProject(project, patch) {
  const fields = [
    "name",
    "code",
    "templateId",
    "units",
    "client",
    "company",
    "engineer",
    "description",
  ];
  for (const field of fields) {
    if (patch[field] !== undefined) project[field] = patch[field];
  }
  await project.save();
  return project;
}

// Deletes the project and every child collection + result in one transaction,
// so no orphaned documents remain.
async function deleteProject(projectId) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Promise.all([
        Project.deleteOne({ _id: projectId }, { session }),
        ...CHILD_MODELS.map(({ Model }) =>
          Model.deleteMany({ projectId }, { session })
        ),
        ModelConfiguration.deleteMany({ projectId }, { session }),
        Result.deleteMany({ projectId }, { session }),
      ]);
    });
    return { deleted: true };
  } finally {
    session.endSession();
  }
}

module.exports = {
  createProject,
  listProjects,
  updateProject,
  deleteProject,
};
