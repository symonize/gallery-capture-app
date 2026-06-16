import { useEffect, useState } from "react";
import PerspectiveCropper from "./PerspectiveCropper";
import DescribeStep from "./DescribeStep";
import ReviewStep from "./ReviewStep";
import { transcribe } from "@/lib/transcribe";
import { parseTranscript } from "@/lib/parse";
import {
  listArtists,
  listCollections,
  findOrCreateArtist,
  findOrCreateCollections,
  createArtwork,
  uploadArtworkImage,
} from "@/lib/airtable";

const ART_TYPES = ["Painting", "Sculpture"];
const TAG_SEED = [
  "landscape",
  "portrait",
  "abstract",
  "still life",
  "figurative",
  "modern",
  "contemporary",
];

/*
  Owns one piece's capture flow across three steps:
    1 → straighten (PerspectiveCropper)
    2 → describe by voice (DescribeStep)
    3 → review + save (ReviewStep)

  All field state lives here so it survives moving between steps. `voiceFilled`
  tracks which fields the voice step populated, so the review step can flag them
  for confirm-as-you-go.

  `rawUrl` is the un-cropped capture; `finalUrl` is the cropped result that gets
  saved. On save we hand a lightweight summary back up via onSaved so the hub can
  list it.
*/
export default function CaptureWizard({ rawUrl, onClose, onSaved }) {
  const [step, setStep] = useState(1);
  const [finalUrl, setFinalUrl] = useState(null);

  const [mode, setMode] = useState("clip");
  const [artType, setArtType] = useState("Painting");
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [artistId, setArtistId] = useState(null);
  const [year, setYear] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);
  // Collections held as names in the draft; resolved to record ids at save time
  // so they attach to whatever artist is final (even if you switch artists).
  const [collectionNames, setCollectionNames] = useState([]);
  const [voiceFilled, setVoiceFilled] = useState(() => new Set());

  const [artists, setArtists] = useState([]);
  const [collections, setCollections] = useState([]);
  const [busyField, setBusyField] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listArtists()
      .then(setArtists)
      .catch((e) =>
        setStatus({ type: "error", msg: `Couldn't load artists: ${e.message}` }),
      );
    listCollections()
      .then(setCollections)
      .catch(() => {
        // Non-blocking: collections are optional. listCollections already
        // swallows a missing table; this catches auth/network errors.
      });
  }, []);

  const markVoice = (key) =>
    setVoiceFilled((prev) => new Set(prev).add(key));

  /* ---------- voice: full-clip parse ---------- */
  async function handleClip(blob) {
    setBusyField("clip");
    setStatus({ type: "info", msg: "Transcribing and parsing…" });
    try {
      const text = await transcribe(blob);
      const parsed = await parseTranscript(text, {
        artTypes: ART_TYPES,
        knownTags: TAG_SEED,
      });
      if (parsed.title) {
        setTitle(parsed.title);
        markVoice("title");
      }
      if (parsed.artist) {
        setArtistName(parsed.artist);
        setArtistId(null);
        markVoice("artist");
      }
      if (parsed.year) {
        setYear(parsed.year);
        markVoice("year");
      }
      if (parsed.art_type) setArtType(parsed.art_type);
      if (parsed.description) {
        setDescription(parsed.description);
        markVoice("description");
      }
      if (parsed.tags?.length)
        setTags((prev) => Array.from(new Set([...prev, ...parsed.tags])));
      if (parsed.collections?.length) {
        setCollectionNames((prev) =>
          Array.from(new Set([...prev, ...parsed.collections])),
        );
        markVoice("collections");
      }
      setStatus({ type: "success", msg: "Fields filled — review and save." });
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    } finally {
      setBusyField(null);
    }
  }

  /* ---------- voice: single-field dictation ---------- */
  function dictateTo(setter, key) {
    return async (blob) => {
      setBusyField(key);
      try {
        const text = (await transcribe(blob)).trim();
        setter(text);
        if (key === "artist") setArtistId(null);
        markVoice(key);
        setStatus(null);
      } catch (e) {
        setStatus({ type: "error", msg: e.message });
      } finally {
        setBusyField(null);
      }
    };
  }

  /* ---------- save ---------- */
  async function save() {
    if (!title.trim() && !artistName.trim()) {
      setStatus({ type: "error", msg: "Add at least a title or artist first." });
      return;
    }
    setSaving(true);
    setStatus({ type: "info", msg: "Saving to Airtable…" });
    try {
      const resolvedArtistId = await findOrCreateArtist(artistName, artists);
      const collectionIds = await findOrCreateCollections(
        collectionNames,
        resolvedArtistId,
        collections,
      );
      const recordId = await createArtwork({
        title,
        artistId: resolvedArtistId,
        artType,
        year,
        description,
        tags,
        collectionIds,
      });
      if (finalUrl) {
        setStatus({ type: "info", msg: "Uploading image…" });
        const base64 = finalUrl.split(",")[1];
        const filename = `${(title || "artwork")
          .replace(/\s+/g, "-")
          .toLowerCase()}.jpg`;
        await uploadArtworkImage(recordId, base64, filename);
      }
      onSaved?.({
        id: recordId,
        title: title.trim() || "Untitled",
        artist: artistName.trim(),
        year: year.trim(),
        thumbUrl: finalUrl,
      });
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
      setSaving(false);
    }
  }

  const stepLabel = ["Straighten", "Describe", "Review"][step - 1];

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* progress header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Discard and close"
          >
            ✕ Discard
          </button>
          <span>
            Step {step} of 3 · {stepLabel}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {step === 1 && (
        <PerspectiveCropper
          imageUrl={rawUrl}
          onConfirm={(dataUrl) => {
            setFinalUrl(dataUrl);
            setStep(2);
          }}
          onSkip={(dataUrl) => {
            setFinalUrl(dataUrl);
            setStep(2);
          }}
          onRetake={onClose}
        />
      )}

      {step === 2 && (
        <DescribeStep
          imageDataUrl={finalUrl}
          mode={mode}
          setMode={setMode}
          title={title}
          setTitle={setTitle}
          artistName={artistName}
          setArtistName={setArtistName}
          year={year}
          setYear={setYear}
          description={description}
          setDescription={setDescription}
          busyField={busyField}
          status={status}
          onClip={handleClip}
          dictateTo={dictateTo}
          onBack={() => setStep(1)}
          onNext={() => {
            setStatus(null);
            setStep(3);
          }}
        />
      )}

      {step === 3 && (
        <ReviewStep
          imageDataUrl={finalUrl}
          artType={artType}
          setArtType={setArtType}
          title={title}
          setTitle={setTitle}
          artistName={artistName}
          setArtistName={setArtistName}
          artistId={artistId}
          setArtistId={setArtistId}
          year={year}
          setYear={setYear}
          description={description}
          setDescription={setDescription}
          tags={tags}
          setTags={setTags}
          artists={artists}
          collections={collections}
          collectionNames={collectionNames}
          setCollectionNames={setCollectionNames}
          voiceFilled={voiceFilled}
          status={status}
          saving={saving}
          onBack={() => setStep(2)}
          onSave={save}
        />
      )}
    </div>
  );
}
