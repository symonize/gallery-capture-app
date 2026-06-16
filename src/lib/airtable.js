import { apiFetch } from "./api";

/*
  Airtable access goes through our own /api/* Netlify Functions, which hold the
  Airtable token server-side. The find-or-create logic stays here on the client
  (it's just match-then-maybe-create over the list + create endpoints).
*/

/* ---------------- Artists ---------------- */

export async function listArtists() {
  return apiFetch("artists"); // [{ id, name }]
}

export async function createArtist({ name, bio = "", nationality = "" }) {
  return apiFetch("artists", {
    method: "POST",
    body: { name, bio, nationality },
  });
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

/* ---------------- Collections ---------------- */

export async function listCollections() {
  return apiFetch("collections"); // [{ id, name, artistId }] ([] if no table)
}

export async function createCollection({ name, artistId }) {
  return apiFetch("collections", {
    method: "POST",
    body: { name, artistId },
  });
}

/*
  Resolve an array of collection names to record ids, scoped to one artist.
  Matches against `existing` only within the artist; creates the rest.
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
      pool.push(created); // dedupe duplicate names within one save
      ids.push(created.id);
    }
  }
  return ids;
}

/* ---------------- Artworks ---------------- */

export async function createArtwork({
  title,
  artistId,
  artType,
  year,
  description,
  tags = [],
  collectionIds = [],
}) {
  const data = await apiFetch("artworks", {
    method: "POST",
    body: { title, artistId, artType, year, description, tags, collectionIds },
  });
  return data.id;
}

/*
  Attach the cropped image (raw base64, no data: prefix) to the artwork record.
*/
export async function uploadArtworkImage(recordId, base64, filename, contentType = "image/jpeg") {
  return apiFetch("upload-image", {
    method: "POST",
    body: { recordId, base64, filename, contentType },
  });
}
