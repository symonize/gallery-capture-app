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
    let msg = `${res.status}`;
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {
      msg = `${res.status}: ${await res.text()}`;
    }
    if (res.status === 401) {
      throw new Error("Unauthorized — check the app password in Settings.");
    }
    throw new Error(msg);
  }
  return res.json();
}
