import { getConfig } from "./config";

/*
  Thin client for our own Netlify Functions under /api/*. Injects the shared app
  password so the server can gate every call. Third-party API keys live only on
  the server — the client never sees them.
*/
const BASE = "/api";

export async function apiFetch(path, { method = "GET", body, headers = {} } = {}) {
  const { appPassword } = getConfig();
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-app-password": appPassword || "",
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Unauthorized — check the app password in Settings.");
    }
    // Read the body ONCE as text, then try to parse it as JSON. Reading it
    // twice (.json() then .text()) throws "body is disturbed or locked" and
    // masks the real error — e.g. a function crash that returns an HTML 500.
    const raw = await res.text();
    let msg = `${res.status}`;
    try {
      const data = JSON.parse(raw);
      msg = data.error || msg;
    } catch {
      msg = raw ? `${res.status}: ${raw.slice(0, 300)}` : `${res.status}`;
    }
    throw new Error(msg);
  }

  // Success: parse JSON defensively too (empty/invalid body shouldn't crash).
  const raw = await res.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Unexpected response from ${path}: ${raw.slice(0, 300)}`);
  }
}
