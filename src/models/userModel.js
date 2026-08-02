const { Schema, model } = require("mongoose");

// App users, mirrored from Clerk via the /api/webhooks/clerk webhook. `clerkId`
// is the same value stored as `ownerId` on projects/catalogs, so existing data
// links here with no migration. Email/name/profile are only populated from
// Clerk user events (user.created / user.updated).
const userSchema = new Schema(
  {
    clerkId: { type: String, required: true, unique: true, index: true }, // Clerk user id
    email: { type: String, index: true },
    firstName: { type: String },
    lastName: { type: String },
    imageUrl: { type: String },
    // Set after the contact was successfully upserted into Mailchimp.
    mailchimpSyncedAt: { type: Date },
  },
  { collection: "users", timestamps: true }
);

module.exports = { User: model("User", userSchema) };
