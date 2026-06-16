import { json, requireAuth } from "./_shared.js";

/*
  Password check for the login screen. Reuses the shared auth gate: a correct
  x-app-password returns 200 { ok: true }; anything else returns 401. No
  upstream calls — this just confirms the password before the app unlocks.
*/
export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only." });
  const auth = requireAuth(event);
  if (auth) return auth;
  return json(200, { ok: true });
}
