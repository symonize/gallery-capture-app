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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

/*
  Step 3 of the capture wizard: review the (mostly voice-filled) fields and save.

  Confirm-as-you-go: any field that voice populated starts in an amber "check
  this" state. Focusing/editing it marks it confirmed (neutral). Save is always
  available, but if amber fields remain it asks "save anyway?" once — a soft
  nudge, not a hard gate.

  `voiceFilled` is a Set of field keys the voice step populated. `confirmed` is
  owned here (review-local). Field values + setters live in the parent wizard.
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

const VOICE_FIELDS = ["title", "artist", "year", "description", "collections"];

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
  voiceFilled,
  status,
  saving,
  onBack,
  onSave,
}) {
  const [confirmed, setConfirmed] = useState(() => new Set());
  const [tagInput, setTagInput] = useState("");
  const [collectionInput, setCollectionInput] = useState("");
  const [pendingSave, setPendingSave] = useState(false);

  const confirm = (key) =>
    setConfirmed((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });

  // A field needs checking if voice filled it and you haven't touched it yet.
  const needsCheck = (key) => voiceFilled.has(key) && !confirmed.has(key);
  const uncheckedCount = VOICE_FIELDS.filter(needsCheck).length;

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

  function attemptSave() {
    if (uncheckedCount > 0 && !pendingSave) {
      setPendingSave(true);
      return;
    }
    setPendingSave(false);
    onSave();
  }

  const isSculpture = artType === "Sculpture";

  return (
    <div className="flex flex-1 flex-col gap-5">
      {imageDataUrl && (
        <img
          src={imageDataUrl}
          alt="Artwork"
          className="mx-auto max-h-40 rounded-lg border"
        />
      )}

      {uncheckedCount > 0 && (
        <p className="text-center text-xs text-amber-600 dark:text-amber-500">
          {uncheckedCount} voice-filled field{uncheckedCount > 1 ? "s" : ""} to
          check — tap each to confirm.
        </p>
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

      <CheckField label="Title" flagged={needsCheck("title")}>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => confirm("title")}
          placeholder="Untitled"
        />
      </CheckField>

      <CheckField label="Artist" flagged={needsCheck("artist")}>
        <Input
          value={artistName}
          onChange={(e) => {
            setArtistName(e.target.value);
            setArtistId(null);
          }}
          onFocus={() => confirm("artist")}
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
      </CheckField>

      {/* Collections — scoped to the selected artist; multi-select */}
      <CheckField label="Collections" flagged={needsCheck("collections")}>
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
                    onClick={() => {
                      confirm("collections");
                      removeCollection(name);
                    }}
                  >
                    {name} ✕
                  </Badge>
                ))}
              </div>
            )}
            <Input
              value={collectionInput}
              onChange={(e) => setCollectionInput(e.target.value)}
              onFocus={() => confirm("collections")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  confirm("collections");
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
                      onClick={() => {
                        confirm("collections");
                        addCollection(c.name);
                      }}
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
      </CheckField>

      <CheckField label="Year" flagged={needsCheck("year")}>
        <Input
          value={year}
          onChange={(e) => setYear(e.target.value)}
          onFocus={() => confirm("year")}
          placeholder="e.g. 1987 or c. 1890"
        />
      </CheckField>

      <CheckField label="Description" flagged={needsCheck("description")}>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onFocus={() => confirm("description")}
          rows={4}
          placeholder="Describe the work…"
        />
      </CheckField>

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

      {pendingSave && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-700 dark:bg-amber-950/40">
          {uncheckedCount} field{uncheckedCount > 1 ? "s" : ""} still unchecked —
          save anyway?
        </div>
      )}

      <div className="mt-auto flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          ← Back
        </Button>
        <Button
          className="flex-1"
          size="lg"
          onClick={attemptSave}
          disabled={saving}
        >
          {saving ? <Spinner className="mr-2" /> : null}
          {pendingSave ? "Save anyway" : "Save artwork"}
        </Button>
      </div>
    </div>
  );
}

/*
  Wraps a field with the confirm-as-you-go amber treatment. When `flagged`,
  shows an amber ring + "check this" hint; the inner input clears it on focus.
*/
function CheckField({ label, flagged, children }) {
  return (
    <Field>
      <div className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        {flagged && (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-500">
            ● tap to confirm
          </span>
        )}
      </div>
      <div
        className={
          flagged
            ? "rounded-md ring-2 ring-amber-400/70 dark:ring-amber-500/60"
            : ""
        }
      >
        {children}
      </div>
    </Field>
  );
}
