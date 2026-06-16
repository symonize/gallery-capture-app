# Gallery Capture — Main Page Rework

**Date:** 2026-06-16
**Status:** Approved for implementation

## Goal

Rework the main page for the real use context: capturing gallery artwork
**mobile, one-handed, on foot**. Optimize for **speed per piece** and
**confident review** of voice-filled fields before saving. Keep the existing
coss/shadcn visual styling. No changes to Airtable, transcription, parsing, or
OpenCV perspective-crop logic.

## Current state

`App.jsx` is a narrow single column with three replace-the-screen stages:
`photo → crop → form`. The form (`CaptureForm.jsx`, 337 lines) does everything:
voice capture (whole-clip + field-by-field), all fields, tags, status, and save.
A `savedCount` is the only session feedback.

## Target architecture

A **Session Hub** as home base plus a **3-step capture wizard** per piece.

State in `App.jsx`:

- `view`: `"hub" | "capture"`
- `session`: array of saved pieces this session
  `{ id, title, artist, year, thumbUrl }` — in-memory, cleared on reload.
- Capture draft + `step` (`1 | 2 | 3`) owned by the wizard.

### Components

- **`SessionHub`** (new) — header (title, Settings ⚙️, "{n} captured this
  session"), scrollable list of session cards (thumbnail + title + artist·year),
  each tappable to re-open that piece in the wizard for editing. Pinned big
  **📷 New artwork** button. Unconfigured-keys notice and empty state live here.
- **`CaptureWizard`** (new, thin) — owns `step`, the field draft state, the
  progress bar ("Step N of 3" + filled track), and back/close affordances.
  Renders the step body:
  - Step 1 → existing **`PerspectiveCropper`** unchanged (sculptures skip
    de-skew as today). "Use this crop →" advances.
  - Step 2 → **`DescribeStep`** (extracted) — pinned cropped image, large mic
    for whole-clip parse, field-by-field mics as fallback. "Next →" advances.
  - Step 3 → **`ReviewStep`** (extracted) — pinned image + all fields,
    confirm-as-you-go, Save.
- **`CaptureForm.jsx`** is split into `DescribeStep` + `ReviewStep`; shared field
  state lifts into `CaptureWizard`. All Airtable/transcribe/parse logic moves
  unchanged.

### Confirm-as-you-go (Step 3)

- Fields **filled by voice** render in an amber "check this" state. **Focusing or
  editing a field confirms it** (turns neutral/green) — no extra taps when
  reviewing anyway. Manually-typed and unfilled-optional fields need no confirm.
- **Soft save gate:** Save is always tappable. If unconfirmed voice fields
  remain, show a quick *"N fields unchecked — save anyway?"* dialog (reuse
  `ui/alert-dialog`). Confident → one extra tap; unsure → caught.
- Confidence source for now: "did voice fill this field." The amber-state hook
  leaves room for per-field parser confidence later.

### Data flow

`onFile → step1(crop) → step2(voice fills draft) → step3(confirm) → save()
→ push {thumb,title,...} to session → return to hub`. Re-opening a session card
loads its draft back into the wizard.

## Error handling / edge cases

- Transcribe/parse/save errors keep today's inline status messages within the
  relevant step.
- Unconfigured keys: New artwork disabled + notice on hub (as today).
- Discard mid-wizard: close (✕) returns to hub without saving; revokes object
  URLs.
- Session is in-memory only (matches today's `savedCount`); reload clears it —
  records are safe in Airtable.

## Testing

Manual mobile-viewport walkthrough: shoot → crop → voice → confirm → save → hub;
edit-from-hub; soft-gate dialog; sculpture-skips-crop. No test framework in repo.

## Out of scope

- Airtable schema / lib changes
- Transcription, parsing, OpenCV changes
- Persisting session across reloads
- Per-field parser confidence scoring (hook left for later)
