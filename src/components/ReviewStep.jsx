import { useMemo, useState } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

/*
  Step 3 of the capture wizard: review the (mostly voice-filled) fields and save.
  All fields are plain editable inputs; field values + setters live in the parent
  wizard.
*/
const ART_TYPES = [
  { label: "Painting", value: "Painting" },
  { label: "Sculpture", value: "Sculpture" },
];

const TAG_SEED = [
  "landscape",
  "portrait",
  "abstract",
  "still life",
  "figurative",
  "modern",
  "contemporary",
];

export default function ReviewStep({
  imageDataUrl,
  artType,
  setArtType,
  title,
  setTitle,
  artistName,
  setArtistName,
  artistId,
  setArtistId,
  year,
  setYear,
  description,
  setDescription,
  tags,
  setTags,
  artists,
  collections,
  collectionNames,
  setCollectionNames,
  status,
}) {
  const [tagInput, setTagInput] = useState("");
  const [collectionInput, setCollectionInput] = useState("");

  const artistMatches = useMemo(() => {
    const q = artistName.trim().toLowerCase();
    if (!q || artistId) return [];
    return artists.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 6);
  }, [artistName, artistId, artists]);

  function addTag(t) {
    const v = t.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagInput("");
  }
  function removeTag(t) {
    setTags(tags.filter((x) => x !== t));
  }

  // Existing collections belonging to the selected artist (or, for a new/
  // unlinked artist, matched by artist name) — offered as quick-add chips.
  const artistCollections = useMemo(() => {
    const all = collections || [];
    if (artistId) return all.filter((c) => c.artistId === artistId);
    // New artist with no id yet: we can't scope by id, so suggest the ones not
    // already chosen and let save() create/attach under the resolved artist.
    return all.filter((c) => c.artistId == null);
  }, [collections, artistId]);

  function addCollection(name) {
    const v = name.trim();
    if (v && !collectionNames.includes(v))
      setCollectionNames([...collectionNames, v]);
    setCollectionInput("");
  }
  function removeCollection(name) {
    setCollectionNames(collectionNames.filter((x) => x !== name));
  }

  const isSculpture = artType === "Sculpture";

  return (
    <div className="flex flex-col gap-5">
      {imageDataUrl && (
        <img
          src={imageDataUrl}
          alt="Artwork"
          className="mx-auto max-h-40 rounded-xl object-contain"
        />
      )}

      <Field>
        <FieldLabel>Art type</FieldLabel>
        <Select items={ART_TYPES} value={artType} onValueChange={setArtType}>
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectPopup>
            {ART_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        {isSculpture && (
          <FieldDescription>
            Sculptures skip the de-skew step — the photo is saved as captured.
          </FieldDescription>
        )}
      </Field>

      <Field>
        <FieldLabel>Title</FieldLabel>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
        />
      </Field>

      <Field>
        <FieldLabel>Artist</FieldLabel>
        <Input
          value={artistName}
          onChange={(e) => {
            setArtistName(e.target.value);
            setArtistId(null);
          }}
          placeholder="Artist name"
          autoComplete="off"
        />
        {artistMatches.length > 0 && (
          <div className="mt-1 flex flex-col rounded-md border bg-popover">
            {artistMatches.map((a) => (
              <button
                key={a.id}
                type="button"
                className="px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  setArtistName(a.name);
                  setArtistId(a.id);
                }}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}
        <FieldDescription>
          {artistId
            ? "Linked to existing artist."
            : artistName.trim()
              ? `New artist “${artistName.trim()}” will be created on save.`
              : "Type to search or add a new artist."}
        </FieldDescription>
      </Field>

      {/* Collections — scoped to the selected artist; multi-select */}
      <Field>
        <FieldLabel>Collections</FieldLabel>
        {!artistName.trim() ? (
          <FieldDescription>Pick an artist first.</FieldDescription>
        ) : (
          <>
            {collectionNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {collectionNames.map((name) => (
                  <Badge
                    key={name}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => removeCollection(name)}
                  >
                    {name} ✕
                  </Badge>
                ))}
              </div>
            )}
            <Input
              value={collectionInput}
              onChange={(e) => setCollectionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addCollection(collectionInput);
                }
              }}
              placeholder="Add a collection and press Enter"
            />
            {artistCollections.filter(
              (c) => !collectionNames.includes(c.name),
            ).length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {artistCollections
                  .filter((c) => !collectionNames.includes(c.name))
                  .map((c) => (
                    <Badge
                      key={c.id}
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => addCollection(c.name)}
                    >
                      + {c.name}
                    </Badge>
                  ))}
              </div>
            )}
            <FieldDescription>
              {artistId
                ? "Showing this artist’s collections. New names are created on save."
                : "New collections will be created under this artist on save."}
            </FieldDescription>
          </>
        )}
      </Field>

      <Field>
        <FieldLabel>Year</FieldLabel>
        <Input
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="e.g. 1987 or c. 1890"
        />
      </Field>

      <Field>
        <FieldLabel>Description</FieldLabel>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe the work…"
        />
      </Field>

      <Field>
        <FieldLabel>Tags</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Badge
              key={t}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => removeTag(t)}
            >
              {t} ✕
            </Badge>
          ))}
        </div>
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(tagInput);
            }
          }}
          placeholder="Add a tag and press Enter"
        />
        <div className="mt-1 flex flex-wrap gap-1.5">
          {TAG_SEED.filter((t) => !tags.includes(t)).map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="cursor-pointer"
              onClick={() => addTag(t)}
            >
              + {t}
            </Badge>
          ))}
        </div>
      </Field>

      {status && (
        <div
          className={
            "rounded-md px-3 py-2 text-sm " +
            (status.type === "error"
              ? "bg-destructive/10 text-destructive"
              : status.type === "success"
                ? "bg-success/10 text-success"
                : "bg-muted text-muted-foreground")
          }
        >
          {status.msg}
        </div>
      )}
    </div>
  );
}
