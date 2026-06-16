import {
  json,
  requireAuth,
  airtableBase,
  env,
  AIRTABLE_CONTENT_API,
} from "./_shared.js";

const TABLE = process.env.ARTWORKS_TABLE || "Artworks";
const FIELD = process.env.ARTWORKS_IMAGE_FIELD || "image";

/*
  POST -> attach a base64 image to an artwork's attachment field via Airtable's
  uploadAttachment endpoint. Body: { recordId, base64, filename, contentType? }.
  base64 must be the raw string WITHOUT the data: URL prefix.
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
  const { recordId, base64, filename, contentType = "image/jpeg" } = payload;
  if (!recordId || !base64) return json(400, { error: "Missing recordId or base64." });

  const res = await fetch(
    `${AIRTABLE_CONTENT_API}/${airtableBase()}/${recordId}/${encodeURIComponent(FIELD)}/uploadAttachment`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("AIRTABLE_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contentType, file: base64, filename }),
    },
  );
  if (!res.ok) return json(res.status, { error: `Airtable ${res.status}: ${await res.text()}` });
  return json(200, await res.json());
}
