import { getConfig } from "./config";

/*
  Parse a free-form spoken transcript into structured artwork fields using
  Claude. Returns: { title, artist, year, art_type, description, tags[] }.
  Browser -> Anthropic direct requires the dangerous-direct-browser-access
  header. Key is exposed (see config.js).
*/
export async function parseTranscript(transcript, { artTypes = [], knownTags = [] } = {}) {
  const { anthropicKey, claudeModel } = getConfig();
  if (!anthropicKey) throw new Error("Missing Anthropic API key (Settings).");

  const system = [
    "You extract structured catalog data for an art gallery from a spoken transcript.",
    "Return ONLY a JSON object, no markdown, no prose, with exactly these keys:",
    '{ "title": string, "artist": string, "year": string, "art_type": string, "description": string, "tags": string[], "collections": string[] }.',
    "Rules:",
    "- year: keep as spoken, allow 'c. 1890' or 'unknown'. Empty string if not mentioned.",
    `- art_type: choose the closest of [${artTypes.join(", ")}] if mentioned, else empty string.`,
    "- description: clean up filler words into a tidy sentence or two, but do not invent details.",
    "- tags: subject/style descriptors of the ARTWORK only (e.g. landscape, portrait, abstract). Do NOT put artist demographics here.",
    knownTags.length
      ? `- Prefer reusing these existing tags when they fit: [${knownTags.join(", ")}].`
      : "",
    "- collections: names of any series/collection the work is said to belong to, e.g. 'part of the Water Lilies series' -> ['Water Lilies']. Strip trailing words like 'series'/'collection'. Empty array if none mentioned.",
    "- Any field not mentioned: empty string (or [] for tags/collections).",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: claudeModel,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: transcript }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Claude ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const clean = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(clean);
    return {
      title: parsed.title || "",
      artist: parsed.artist || "",
      year: parsed.year || "",
      art_type: parsed.art_type || "",
      description: parsed.description || "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      collections: Array.isArray(parsed.collections) ? parsed.collections : [],
    };
  } catch {
    // If parsing fails, hand back the raw text in description so nothing is lost.
    return { title: "", artist: "", year: "", art_type: "", description: clean, tags: [], collections: [] };
  }
}
