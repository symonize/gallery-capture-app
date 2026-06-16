/*
  Client config. The only secret the client holds now is the shared app
  password, used to authenticate calls to our own /api/* Netlify Functions.

  All third-party API keys (OpenAI, Anthropic, Airtable) and the Airtable
  base/table names live server-side in Netlify env vars and never reach the
  browser bundle — see netlify/functions/ and .env.example.
*/

const LS_KEY = "gallery-capture:config";

const DEFAULTS = {
  appPassword: "",
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
  localStorage.setItem(LS_KEY, JSON.stringify(next));
  return next;
}

export function isConfigured() {
  return Boolean(getConfig().appPassword);
}
