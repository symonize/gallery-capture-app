import { apiFetch } from "./api";

/*
  Parse a free-form spoken transcript into structured artwork fields via our
  /api/parse function, which proxies Anthropic server-side. Returns:
  { title, artist, year, art_type, description, tags[], collections[] }.
*/
export async function parseTranscript(transcript, { artTypes = [], knownTags = [] } = {}) {
  return apiFetch("parse", {
    method: "POST",
    body: { transcript, artTypes, knownTags },
  });
}
