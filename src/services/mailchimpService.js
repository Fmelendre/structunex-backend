const crypto = require("crypto");
const axios = require("axios");
const { env } = require("../config/env");
const { AppError } = require("../middleware/errorHandler");

// Adds/updates registered users in the Mailchimp audience. Called from the Clerk
// webhook. Uses the Marketing API v3 upsert (PUT by subscriber hash) so repeated
// webhook deliveries are idempotent.

const SIGNUP_TAG = "app-signup";

function isConfigured() {
  return Boolean(
    env.mailchimpApiKey && env.mailchimpServerPrefix && env.mailchimpAudienceId
  );
}

function baseUrl() {
  return `https://${env.mailchimpServerPrefix}.api.mailchimp.com/3.0/lists/${env.mailchimpAudienceId}`;
}

// Mailchimp identifies a member by the MD5 of the lowercased email.
function subscriberHash(email) {
  return crypto.createHash("md5").update(email.trim().toLowerCase()).digest("hex");
}

const authConfig = () => ({
  // Mailchimp uses HTTP Basic auth: any username + the API key as the password.
  auth: { username: "structunex", password: env.mailchimpApiKey },
  timeout: 10000,
});

// Upsert the contact and tag it. On permanent (4xx) errors we log and return
// { skipped } so Clerk doesn't retry forever; transient/network errors throw an
// AppError → the webhook returns non-2xx and Clerk retries.
async function addOrUpdateMember({ email, firstName, lastName }) {
  if (!isConfigured()) {
    console.warn("[mailchimp] not configured — skipping sync for", email);
    return { skipped: true };
  }
  if (!email) return { skipped: true };

  const hash = subscriberHash(email);

  try {
    await axios.put(
      `${baseUrl()}/members/${hash}`,
      {
        email_address: email,
        status_if_new: "subscribed",
        merge_fields: { FNAME: firstName || "", LNAME: lastName || "" },
      },
      authConfig()
    );

    await axios.post(
      `${baseUrl()}/members/${hash}/tags`,
      { tags: [{ name: SIGNUP_TAG, status: "active" }] },
      authConfig()
    );

    return { ok: true };
  } catch (err) {
    const status = err.response && err.response.status;
    // 4xx = permanent (bad email, compliance state, etc.): log and move on.
    if (status && status >= 400 && status < 500) {
      console.warn(
        "[mailchimp] permanent error for",
        email,
        status,
        err.response.data && err.response.data.title
      );
      return { skipped: true, status };
    }
    // Network / 5xx = transient: let Clerk retry.
    throw new AppError(
      502,
      `Mailchimp sync failed (${err.code || status || err.message})`
    );
  }
}

module.exports = { addOrUpdateMember };
