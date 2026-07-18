const mongoose = require("mongoose");
const { CHILD_MODELS, ModelConfiguration } = require("../models");

// Reads/writes the whole structural model (nodes, materials, sections,
// elements, supports, loads, areas) as one nested object, so the frontend can
// hydrate and autosave in a single round-trip instead of one call per entity.

const BY_KEY = Object.fromEntries(CHILD_MODELS.map((c) => [c.key, c.Model]));

// Assembles the nested model from the project's child collections, stripping
// Mongo bookkeeping so the shape matches the frontend StructuralModel.
async function getModel(projectId) {
  const [entries, config] = await Promise.all([
    Promise.all(
      CHILD_MODELS.map(({ key, Model }) =>
        Model.find({ projectId })
          .select("-_id -projectId -__v -createdAt -updatedAt")
          .lean()
          .then((docs) => [key, docs])
      )
    ),
    ModelConfiguration.findOne({ projectId })
      .select("-_id -projectId -__v -createdAt -updatedAt")
      .lean(),
  ]);
  return { ...Object.fromEntries(entries), configuration: config || null };
}

// Swaps each listed collection for the incoming array. `session` is passed when
// running inside a transaction; null for the standalone fallback.
async function replaceCollections(projectId, keys, model, session) {
  const opts = session ? { session } : {};
  for (const key of keys) {
    const Model = BY_KEY[key];
    await Model.deleteMany({ projectId }, opts);
    const docs = model[key].map((d) => ({ ...d, projectId }));
    if (docs.length) await Model.insertMany(docs, opts);
  }
}

// True when the error means the Mongo deployment has no transaction support
// (standalone mongod) — as opposed to a real write error we must surface.
function isNoTxnSupport(err) {
  const msg = String((err && err.message) || "");
  return (
    err?.code === 20 || // IllegalOperation
    err?.codeName === "IllegalOperation" ||
    /Transaction numbers are only allowed|replica set member or mongos|Transactions are not supported/i.test(
      msg
    )
  );
}

// Reconcile by collection: for every entity key present in `model`, swap the
// whole collection for the incoming array. Absent keys are left untouched (so an
// autosave can send only the collections that changed). Domain-id uniqueness is
// enforced by each model's compound index.
//
// Prefers a transaction (atomic swap across collections). If the deployment is a
// standalone mongod (no transactions), falls back to a sequential replace — the
// swap is then non-atomic, acceptable for single-user autosave.
async function saveModel(projectId, model) {
  const keys = Object.keys(model).filter(
    (k) => BY_KEY[k] && Array.isArray(model[k])
  );
  const config = model.configuration; // objeto único (grid + defaults), o ausente

  const applyAll = async (session) => {
    await replaceCollections(projectId, keys, model, session);
    if (config != null) {
      await ModelConfiguration.findOneAndUpdate(
        { projectId },
        { $set: { ...config, projectId } },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          ...(session ? { session } : {}),
        }
      );
    }
  };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await applyAll(session);
    });
  } catch (err) {
    if (!isNoTxnSupport(err)) throw err;
    await applyAll(null);
  } finally {
    session.endSession();
  }

  return getModel(projectId);
}

module.exports = { getModel, saveModel };
