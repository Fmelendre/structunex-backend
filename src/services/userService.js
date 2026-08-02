const { User } = require("../models");

// Persists app users mirrored from Clerk webhook events. Keyed by `clerkId`
// (same value as `ownerId` on projects/catalogs), so writes are idempotent on
// webhook re-delivery.

async function upsertFromClerk({ clerkId, email, firstName, lastName, imageUrl }) {
  return User.findOneAndUpdate(
    { clerkId },
    { $set: { email, firstName, lastName, imageUrl } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function markMailchimpSynced(clerkId) {
  return User.updateOne({ clerkId }, { $set: { mailchimpSyncedAt: new Date() } });
}

async function deleteByClerkId(clerkId) {
  return User.deleteOne({ clerkId });
}

module.exports = { upsertFromClerk, markMailchimpSynced, deleteByClerkId };
