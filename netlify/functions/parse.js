import { json, requireAuth, env } from "./_shared.js";

/*
  Proxy Anthropic. Client POSTs { transcript, artTypes[], knownTags[] }; we
  build the same extraction prompt the old client used and return the parsed
  catalog fields. The Anthropic key stays on the server.
*/
export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only." });
  const auth = requireAuth(event);
  if (auth) return auth;

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }
  const { transcript = "", artTypes = [], knownTags = [] } = payload;
  if (!transcript.trim()) return json(400, { error: "Missing transcript." });

  const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

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

  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: transcript }],
      }),
    });
  } catch (e) {
    return json(502, { error: `Claude request failed: ${e.message}` });
  }
  if (!res.ok) {
    return json(res.status, { error: `Claude ${res.status}: ${await res.text()}` });
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
    return json(200, {
      title: parsed.title || "",
      artist: parsed.artist || "",
      year: parsed.year || "",
      art_type: parsed.art_type || "",
      description: parsed.description || "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      collections: Array.isArray(parsed.collections) ? parsed.collections : [],
    });
  } catch {
    // If the model didn't return clean JSON, keep the text in description.
    return json(200, {
      title: "",
      artist: "",
      year: "",
      art_type: "",
      description: clean,
      tags: [],
      collections: [],
    });
  }
}
