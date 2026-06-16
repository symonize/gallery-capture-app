import { motion } from "motion/react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MicButton } from "./VoiceCapture";
import { springSnappy } from "@/lib/motion";

/*
  Step 2 (Transcribe): dictate the artwork details. Whole-clip mode is primary
  (one hold-to-talk fills everything via transcribe + parse); field-by-field is
  the fallback. Body-only — the sheet owns the Back/Next footer.
*/
export default function DescribeStep({
  imageDataUrl,
  mode,
  setMode,
  title,
  setTitle,
  artistName,
  setArtistName,
  year,
  setYear,
  description,
  setDescription,
  busyField,
  status,
  onClip,
  dictateTo,
}) {
  return (
    <div className="flex flex-col gap-5">
      {imageDataUrl && (
        <motion.img
          src={imageDataUrl}
          alt="Artwork"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springSnappy}
          className="mx-auto max-h-40 rounded-xl object-contain"
        />
      )}

      {/* primary whole-clip mic */}
      {mode === "clip" && (
        <div className="flex flex-col items-center gap-3">
          <MicButton
            onComplete={onClip}
            busy={busyField === "clip"}
            label="Start Transcription"
          />
          <p className="max-w-xs text-center text-xs text-muted-foreground">
            Hold and say it naturally — e.g. “Autumn Study by Maria Chen, 1987,
            oil on canvas, warm pastoral landscape.”
          </p>
        </div>
      )}

      {/* mode toggle */}
      <div className="relative flex rounded-full border border-border p-1 text-sm">
        {["clip", "fields"].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={
              "relative z-10 flex-1 rounded-full py-1.5 transition-colors " +
              (mode === m ? "text-white" : "text-muted-foreground")
            }
          >
            {mode === m && (
              <motion.span
                layoutId="describe-mode"
                transition={springSnappy}
                className="absolute inset-0 -z-10 rounded-full bg-primary"
              />
            )}
            {m === "clip" ? "Describe everything" : "Field by field"}
          </button>
        ))}
      </div>

      {mode === "fields" && (
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Title</FieldLabel>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled"
            />
            <MicButton
              size="sm"
              onComplete={dictateTo(setTitle, "title")}
              busy={busyField === "title"}
              label="Dictate title"
            />
          </Field>
          <Field>
            <FieldLabel>Artist</FieldLabel>
            <Input
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="Artist name"
              autoComplete="off"
            />
            <MicButton
              size="sm"
              onComplete={dictateTo(setArtistName, "artist")}
              busy={busyField === "artist"}
              label="Dictate artist"
            />
          </Field>
          <Field>
            <FieldLabel>Year</FieldLabel>
            <Input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 1987 or c. 1890"
            />
            <MicButton
              size="sm"
              onComplete={dictateTo(setYear, "year")}
              busy={busyField === "year"}
              label="Dictate year"
            />
          </Field>
          <Field>
            <FieldLabel>Description</FieldLabel>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the work…"
            />
            <MicButton
              size="sm"
              onComplete={dictateTo(setDescription, "description")}
              busy={busyField === "description"}
              label="Dictate description"
            />
          </Field>
        </div>
      )}

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
