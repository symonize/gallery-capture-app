import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MicButton } from "./VoiceCapture";

/*
  Step 2 of the capture wizard: dictate the artwork details.

  Whole-clip mode is primary (one hold-to-talk that fills everything via
  transcribe + parse). Field-by-field mics are the fallback. The cropped image
  stays pinned at the top so you can read the piece while you talk.

  All field state and the voice handlers live in the parent wizard — this is a
  presentational step.
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
  onBack,
  onNext,
}) {
  return (
    <div className="flex flex-1 flex-col gap-5">
      {imageDataUrl && (
        <img
          src={imageDataUrl}
          alt="Artwork"
          className="mx-auto max-h-44 rounded-lg border"
        />
      )}

      {/* voice mode toggle */}
      <div className="inline-flex w-full rounded-md border p-0.5">
        <Button
          className="flex-1"
          size="sm"
          variant={mode === "clip" ? "default" : "ghost"}
          onClick={() => setMode("clip")}
        >
          Describe everything
        </Button>
        <Button
          className="flex-1"
          size="sm"
          variant={mode === "fields" ? "default" : "ghost"}
          onClick={() => setMode("fields")}
        >
          Field by field
        </Button>
      </div>

      {mode === "clip" ? (
        <div className="flex flex-col items-center gap-3 rounded-lg bg-muted/40 p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Speak it all naturally — e.g. “Title Autumn Study, artist Maria Chen,
            1987, oil on canvas, warm pastoral landscape.”
          </p>
          <MicButton
            onComplete={onClip}
            busy={busyField === "clip"}
            label="Hold to describe"
          />
        </div>
      ) : (
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
        <StatusBanner status={status} />
      )}

      <div className="mt-auto flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          ← Back
        </Button>
        <Button className="flex-1" size="lg" onClick={onNext}>
          Next →
        </Button>
      </div>
    </div>
  );
}

function StatusBanner({ status }) {
  return (
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
  );
}
