const { isValidObjectId } = require("mongoose");
const { Project } = require("../models");
const { AppError, asyncHandler } = require("./errorHandler");

// Loads the project named in the route and verifies it belongs to the
// authenticated Clerk user (req.userId, set by requireAuth). Attaches it so
// downstream handlers/services never re-check ownership. A missing match — or a
// malformed id — is a 404 (not 403) so we never reveal that a project exists.
const loadProject = asyncHandler(async (req, _res, next) => {
  const { projectId } = req.params;
  if (!isValidObjectId(projectId)) {
    return next(new AppError(404, "Project not found"));
  }
  const project = await Project.findOne({ _id: projectId, ownerId: req.userId });
  if (!project) return next(new AppError(404, "Project not found"));
  req.project = project;
  req.projectId = project._id;
  next();
});

module.exports = { loadProject };
