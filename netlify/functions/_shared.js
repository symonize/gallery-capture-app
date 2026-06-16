import crypto from "node:crypto";

/*
  Shared helpers for the Netlify Functions that proxy OpenAI, Anthropic, and
  Airtable. All third-party keys live in process.env and never reach the client.
  Every function gates on a shared app password sent as the x-app-password
  header.
*/

export function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// Constant-time comparison so the password can't be guessed via timing.
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/*
  Returns null if authorized; otherwise a 401/500 response object the caller
  should return directly. Fails closed: if APP_PASSWORD isn't configured on the
  server, no request is allowed.
*/
export function requireAuth(event) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return json(500, { error: "Server missing APP_PASSWORD." });
  }
  const provided =
    event.headers["x-app-password"] || event.headers["X-App-Password"] || "";
  if (!provided || !safeEqual(provided, expected)) {
    return json(401, { error: "Unauthorized." });
  }
  return null;
}

export function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Server missing ${name}.`);
  return v;
}

const AIRTABLE_API = "https://api.airtable.com/v0";
const AIRTABLE_CONTENT_API = "https://content.airtable.com/v0";

export function airtableBase() {
  return env("AIRTABLE_BASE_ID");
}

export function airtableHeaders() {
  return {
    Authorization: `Bearer ${env("AIRTABLE_TOKEN")}`,
    "Content-Type": "application/json",
  };
}

export { AIRTABLE_API, AIRTABLE_CONTENT_API };

// Pass an upstream fetch Response's error through with its status + text.
export async function relayUpstream(res, label) {
  if (!res.ok) {
    const text = await res.text();
    return json(res.status, { error: `${label} ${res.status}: ${text}` });
  }
  return null;
}
