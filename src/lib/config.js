/*
  Central config. Keys are read from localStorage (set via the in-app Settings
  sheet) with a Vite env fallback for local dev.

  SECURITY NOTE: in a pure client-side PWA these keys live in the browser and
  are visible to anyone with the device / devtools. That's an acceptable
  tradeoff for a personal capture tool that only you run. If gallery staff will
  use this, move the three API calls (Whisper, Claude, Airtable) behind
  serverless functions and have the client call those instead — see README
  "Upgrade path". The lib functions below are the only place that touches keys,
  so that swap is a localized change.
*/

const LS_KEY = "gallery-capture:config";

const ENV = import.meta.env;

const DEFAULTS = {
  openaiKey: ENV.VITE_OPENAI_API_KEY || "",
  anthropicKey: ENV.VITE_ANTHROPIC_API_KEY || "",
  airtableToken: ENV.VITE_AIRTABLE_TOKEN || "",
  airtableBaseId: ENV.VITE_AIRTABLE_BASE_ID || "",
  // Tables — change here if you rename them in Airtable.
  artworksTable: "Artworks",
  artistsTable: "Artists",
  collectionsTable: "Collections",
  // Model used to parse the transcript into fields. Update to whatever
  // current Claude model you prefer.
  claudeModel: "claude-sonnet-4-6",
};

export function getConfig() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    stored = {};
  }
  return { ...DEFAULTS, ...stored };
}

export function saveConfig(patch) {
  const next = { ...getConfig(), ...patch };
  // Don't persist the env-only defaults if they're blank user entries
  localStorage.setItem(LS_KEY, JSON.stringify(next));
  return next;
}

export function isConfigured() {
  const c = getConfig();
  return Boolean(
    c.openaiKey && c.anthropicKey && c.airtableToken && c.airtableBaseId,
  );
}
