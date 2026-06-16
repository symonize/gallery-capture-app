import { getConfig } from "./config";

const API = "https://api.airtable.com/v0";
const CONTENT_API = "https://content.airtable.com/v0";

function headers() {
  const { airtableToken } = getConfig();
  return {
    Authorization: `Bearer ${airtableToken}`,
    "Content-Type": "application/json",
  };
}

async function handle(res) {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable ${res.status}: ${body}`);
  }
  return res.json();
}

/* ---------------- Artists (linked table) ---------------- */

// Fetch all artists once so the capture form can offer match-or-create.
export async function listArtists() {
  const { airtableBaseId, artistsTable } = getConfig();
  const records = [];
  let offset;
  do {
    const url = new URL(`${API}/${airtableBaseId}/${encodeURIComponent(artistsTable)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const data = await handle(await fetch(url, { headers: headers() }));
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records.map((r) => ({ id: r.id, name: r.fields.name || "" }));
}

export async function createArtist({ name, bio = "", nationality = "" }) {
  const { airtableBaseId, artistsTable } = getConfig();
  const data = await handle(
    await fetch(`${API}/${airtableBaseId}/${encodeURIComponent(artistsTable)}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ fields: { name, bio, nationality } }),
    }),
  );
  return { id: data.id, name: data.fields.name };
}

// Returns an existing artist id (case-insensitive name match) or creates one.
export async function findOrCreateArtist(name, existing) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const hit = (existing || []).find(
    (a) => a.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (hit) return hit.id;
  const created = await createArtist({ name: trimmed });
  return created.id;
}

/* ---------------- Collections (linked table) ---------------- */

/*
  Fetch all collections. Each collection belongs to one artist; we read the
  first id from its `artist` link so the capture UI can filter collections to
  the selected artist. Returns [] (not an error) if the table doesn't exist yet,
  so capture still works before you create the Collections table.
*/
export async function listCollections() {
  const { airtableBaseId, collectionsTable } = getConfig();
  const records = [];
  let offset;
  try {
    do {
      const url = new URL(
        `${API}/${airtableBaseId}/${encodeURIComponent(collectionsTable)}`,
      );
      url.searchParams.set("pageSize", "100");
      if (offset) url.searchParams.set("offset", offset);
      const data = await handle(await fetch(url, { headers: headers() }));
      records.push(...data.records);
      offset = data.offset;
    } while (offset);
  } catch (e) {
    // Table missing / not set up yet — treat as "no collections".
    if (/Airtable 40[34]/.test(e.message)) return [];
    throw e;
  }
  return records.map((r) => ({
    id: r.id,
    name: r.fields.name || "",
    artistId: Array.isArray(r.fields.artist) ? r.fields.artist[0] : null,
  }));
}

export async function createCollection({ name, artistId }) {
  const { airtableBaseId, collectionsTable } = getConfig();
  const fields = { name };
  if (artistId) fields.artist = [artistId];
  const data = await handle(
    await fetch(
      `${API}/${airtableBaseId}/${encodeURIComponent(collectionsTable)}`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ fields, typecast: true }),
      },
    ),
  );
  return {
    id: data.id,
    name: data.fields.name,
    artistId: Array.isArray(data.fields.artist) ? data.fields.artist[0] : null,
  };
}

/*
  Resolve an array of collection names to record ids, scoped to one artist.
  Existing collections are matched case-insensitively against `existing` but
  only when they belong to `artistId` (so two artists can both have a
  "Untitled Series"). Names with no match are created under the artist.
*/
export async function findOrCreateCollections(names, artistId, existing) {
  const wanted = Array.from(
    new Set((names || []).map((n) => n.trim()).filter(Boolean)),
  );
  if (!wanted.length) return [];
  const pool = existing || [];
  const ids = [];
  for (const name of wanted) {
    const hit = pool.find(
      (c) =>
        c.name.toLowerCase() === name.toLowerCase() &&
        (!artistId || !c.artistId || c.artistId === artistId),
    );
    if (hit) {
      ids.push(hit.id);
    } else {
      const created = await createCollection({ name, artistId });
      pool.push(created); // so duplicate names within one save dedupe
      ids.push(created.id);
    }
  }
  return ids;
}

/* ---------------- Artworks ---------------- */

// Creates the artwork record (without the image), returns the record id.
// art_type: single-select, tags: multi-select (array), artist: linked (array of ids)
export async function createArtwork({
  title,
  artistId,
  artType,
  year,
  description,
  tags = [],
  collectionIds = [],
}) {
  const { airtableBaseId, artworksTable } = getConfig();
  const fields = {
    title: title || "",
    year: year || "",
    description: description || "",
  };
  if (artType) fields.art_type = artType;
  if (artistId) fields.artist = [artistId];
  if (tags.length) fields.tags = tags;
  if (collectionIds.length) fields.collections = collectionIds;

  const data = await handle(
    await fetch(`${API}/${airtableBaseId}/${encodeURIComponent(artworksTable)}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ fields, typecast: true }),
    }),
  );
  return data.id;
}

/*
  Upload the cropped image straight into the attachment field via Airtable's
  uploadAttachment endpoint (accepts base64 — no need to host the file first).
  `base64` must be the raw base64 string WITHOUT the data: URL prefix.
  Requires a token with data.recordComments:write + the base's write scope.
*/
export async function uploadArtworkImage(recordId, base64, filename, contentType = "image/jpeg") {
  const { airtableBaseId, airtableToken } = getConfig();
  const res = await fetch(
    `${CONTENT_API}/${airtableBaseId}/${recordId}/image/uploadAttachment`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${airtableToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contentType, file: base64, filename }),
    },
  );
  return handle(res);
}
