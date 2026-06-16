import {
  json,
  requireAuth,
  airtableBase,
  airtableHeaders,
  AIRTABLE_API,
} from "./_shared.js";

const TABLE = process.env.COLLECTIONS_TABLE || "Collections";

/*
  GET  -> list all collections [{ id, name, artistId }]. Returns [] if the
          table doesn't exist yet (so capture works before setup).
  POST -> create collection { name, artistId? } -> { id, name, artistId }
*/
export async function handler(event) {
  const auth = requireAuth(event);
  if (auth) return auth;

  const base = airtableBase();

  if (event.httpMethod === "GET") {
    const records = [];
    let offset;
    try {
      do {
        const url = new URL(`${AIRTABLE_API}/${base}/${encodeURIComponent(TABLE)}`);
        url.searchParams.set("pageSize", "100");
        if (offset) url.searchParams.set("offset", offset);
        const res = await fetch(url, { headers: airtableHeaders() });
        if (res.status === 403 || res.status === 404) return json(200, []);
        if (!res.ok) return json(res.status, { error: `Airtable ${res.status}: ${await res.text()}` });
        const data = await res.json();
        records.push(...data.records);
        offset = data.offset;
      } while (offset);
    } catch (e) {
      return json(502, { error: `Airtable request failed: ${e.message}` });
    }
    return json(
      200,
      records.map((r) => ({
        id: r.id,
        name: r.fields.name || "",
        artistId: Array.isArray(r.fields.artist) ? r.fields.artist[0] : null,
      })),
    );
  }

  if (event.httpMethod === "POST") {
    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON body." });
    }
    const { name, artistId } = payload;
    if (!name?.trim()) return json(400, { error: "Missing name." });

    const fields = { name };
    if (artistId) fields.artist = [artistId];

    const res = await fetch(`${AIRTABLE_API}/${base}/${encodeURIComponent(TABLE)}`, {
      method: "POST",
      headers: airtableHeaders(),
      body: JSON.stringify({ fields, typecast: true }),
    });
    if (!res.ok) return json(res.status, { error: `Airtable ${res.status}: ${await res.text()}` });
    const data = await res.json();
    return json(200, {
      id: data.id,
      name: data.fields.name,
      artistId: Array.isArray(data.fields.artist) ? data.fields.artist[0] : null,
    });
  }

  return json(405, { error: "GET or POST only." });
}
