const mongoose = require("mongoose");
const {
  Project,
  AnalysisRun,
  ModelConfiguration,
  CHILD_MODELS,
} = require("../models");
const s3Service = require("./s3Service");

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

// Deletes the project and every child collection + analysis run in one transaction,
// so no orphaned documents remain.
//
// The Parquet results in S3 cannot join the transaction, so they go afterwards and
// best-effort: if that delete fails the documents are already gone and the bucket's
// lifecycle rule is what eventually reclaims the objects. Doing it before the commit
// would be worse — a rolled-back transaction would have destroyed live results.
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
        AnalysisRun.deleteMany({ projectId }, { session }),
      ]);
    });
  } finally {
    session.endSession();
  }
  await s3Service.deleteProjectResults(projectId).catch(() => {});
  return { deleted: true };
}

module.exports = {
  createProject,
  listProjects,
  updateProject,
  deleteProject,
};
