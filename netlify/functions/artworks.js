import {
  json,
  requireAuth,
  airtableBase,
  airtableHeaders,
  AIRTABLE_API,
} from "./_shared.js";

const TABLE = process.env.ARTWORKS_TABLE || "Artworks";

/*
  POST -> create an artwork record (image uploaded separately via upload-image).
  Body: { title, artistId, artType, year, description, tags[], collectionIds[] }
  Returns { id }.
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
  const {
    title = "",
    artistId,
    artType,
    year = "",
    description = "",
    tags = [],
    collectionIds = [],
  } = payload;

  const fields = { title, year, description };
  if (artType) fields.art_type = artType;
  if (artistId) fields.artist = [artistId];
  if (tags.length) fields.tags = tags;
  if (collectionIds.length) fields.collections = collectionIds;

  const res = await fetch(`${AIRTABLE_API}/${airtableBase()}/${encodeURIComponent(TABLE)}`, {
    method: "POST",
    headers: airtableHeaders(),
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) return json(res.status, { error: `Airtable ${res.status}: ${await res.text()}` });
  const data = await res.json();
  return json(200, { id: data.id });
}
