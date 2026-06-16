import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import CaptureStep from "./CaptureStep";
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
import { springGentle, springSnappy, stepVariants, tapScale } from "@/lib/motion";

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

// Figma stepper labels mapped to the flow: Image=capture+straighten,
// Transcribe=describe/voice, Verify=review+save.
const STEPS = ["Image", "Transcribe", "Verify"];

/*
  Fixed-height bottom sheet that hosts the 3-step capture wizard. The sheet
  header (title + ✕ + stepper) and footer (step buttons) are pinned; only the
  step body between them scrolls. All field state + Airtable logic live here.
*/
export default function CaptureSheet({ rawUrl, onClose, onSaved }) {
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1); // animation direction
  const [finalUrl, setFinalUrl] = useState(null);

  const [mode, setMode] = useState("clip");
  const [artType, setArtType] = useState("Painting");
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [artistId, setArtistId] = useState(null);
  const [year, setYear] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);
  const [collectionNames, setCollectionNames] = useState([]);

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
      .catch(() => {});
  }, []);

  const go = (next) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

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
      if (parsed.title) setTitle(parsed.title);
      if (parsed.artist) {
        setArtistName(parsed.artist);
        setArtistId(null);
      }
      if (parsed.year) setYear(parsed.year);
      if (parsed.art_type) setArtType(parsed.art_type);
      if (parsed.description) setDescription(parsed.description);
      if (parsed.tags?.length)
        setTags((prev) => Array.from(new Set([...prev, ...parsed.tags])));
      if (parsed.collections?.length)
        setCollectionNames((prev) =>
          Array.from(new Set([...prev, ...parsed.collections])),
        );
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
      const base64 = finalUrl?.startsWith("data:")
        ? finalUrl.split(",")[1]
        : null;
      if (base64) {
        setStatus({ type: "info", msg: "Uploading image…" });
        const filename = `${(title || "artwork")
          .replace(/\s+/g, "-")
          .toLowerCase()}.jpg`;
        await uploadArtworkImage(recordId, base64, filename);
      }
      onSaved?.({
        id: recordId,
        title: title.trim() || "Untitled",
        artist: artistName.trim(),
        artType,
        year: year.trim(),
        thumbUrl: finalUrl,
      });
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
      setSaving(false);
    }
  }

  return (
    <>
      {/* backdrop */}
      <motion.div
        className="fixed inset-0 z-40 bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* fixed-height sheet */}
      <motion.div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[88vh] max-w-xl flex-col rounded-t-[28px] border-t border-border bg-background"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={springGentle}
      >
        {/* ---- fixed header ---- */}
        <div className="shrink-0 px-6 pb-4 pt-5">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-medium tracking-[-0.02em]">
              Add new artwork
            </h2>
            <motion.button
              type="button"
              onClick={onClose}
              aria-label="Close"
              {...tapScale}
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </motion.button>
          </div>

          <Stepper step={step} />
        </div>

        {/* ---- scrollable body ---- */}
        <div className="relative flex-1 overflow-y-auto px-6">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={springGentle}
              className="flex min-h-full flex-col pb-4"
            >
              {step === 1 && (
                <CaptureStep
                  imageUrl={rawUrl}
                  onCropped={(dataUrl) => {
                    setFinalUrl(dataUrl);
                    go(2);
                  }}
                  onClose={onClose}
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
                  status={status}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ---- fixed footer ---- */}
        <div className="shrink-0 border-t border-border px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {step === 2 && (
            <div className="flex gap-3">
              <FooterButton variant="secondary" onClick={() => go(1)}>
                <ChevronLeft className="size-4" /> Back
              </FooterButton>
              <FooterButton
                onClick={() => {
                  setStatus(null);
                  go(3);
                }}
              >
                Next <ChevronRight className="size-4" />
              </FooterButton>
            </div>
          )}
          {step === 3 && (
            <div className="flex gap-3">
              <FooterButton variant="secondary" onClick={() => go(2)}>
                <ChevronLeft className="size-4" /> Back
              </FooterButton>
              <FooterButton onClick={save} disabled={saving}>
                {saving ? <Spinner className="size-4" /> : null}
                Save
              </FooterButton>
            </div>
          )}
          {step === 1 && (
            <p className="text-center text-xs text-muted-foreground">
              Straighten the artwork, then continue.
            </p>
          )}
        </div>
      </motion.div>
    </>
  );
}

/* Pinned stepper: Image ✓ — Transcribe — Verify, with animated progress. */
function Stepper({ step }) {
  return (
    <div className="mt-5 flex items-center">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={{
                  scale: active ? 1.1 : 1,
                  backgroundColor: done || active ? "#276dff" : "rgba(255,255,255,0.08)",
                }}
                transition={springSnappy}
                className="flex size-7 items-center justify-center rounded-full text-xs font-medium text-white"
              >
                {done ? <Check className="size-4" /> : n}
              </motion.div>
              <span
                className={
                  "text-[11px] " +
                  (active ? "text-foreground" : "text-muted-foreground")
                }
              >
                {label}
              </span>
            </div>
            {n < STEPS.length && (
              <div className="mx-1 mb-5 h-px flex-1 overflow-hidden bg-white/10">
                <motion.div
                  className="h-full bg-primary"
                  initial={false}
                  animate={{ scaleX: n < step ? 1 : 0 }}
                  style={{ originX: 0 }}
                  transition={springGentle}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FooterButton({ children, variant, ...props }) {
  return (
    <motion.div className="flex-1" {...tapScale}>
      <Button
        className="h-12 w-full gap-1 rounded-full text-base"
        variant={variant === "secondary" ? "secondary" : "default"}
        {...props}
      >
        {children}
      </Button>
    </motion.div>
  );
}
