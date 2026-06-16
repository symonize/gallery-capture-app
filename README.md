# Gallery Capture

A phone-first PWA for cataloging artworks: take a photo, straighten it with
on-device perspective correction, dictate the details by voice, and save
straight to Airtable.

- **Photo → de-skew**: client-side perspective correction with OpenCV.js. Drag
  the four corners to the edges of the painting; it warps to a flat,
  cropped rectangle. Sculptures skip this step (tap **Use as-is**).
- **Voice → fields**: two modes — *Describe everything* (one clip, Whisper
  transcribes, Claude parses into title/artist/year/type/description/tags) or
  *Field by field* (a mic button per field).
- **Save**: creates the Artwork record, links/creates the Artist, and uploads
  the cropped image into the attachment field.

Built with **Vite + React**, **coss ui** (Base UI + Tailwind v4), OpenAI
Whisper, the Anthropic API, and Airtable.

---

## 1. Install dependencies

```bash
pnpm install      # or npm install / yarn
```

## 2. Add the coss ui components (one command)

The UI components aren't committed — coss ui is copy-paste/own-your-source, so
you pull them in with the shadcn CLI. This project's `components.json` is
already configured (neutral base color, `@/components/ui`, `src/index.css`).

```bash
# styling tokens + fonts (writes the success/warning/info tokens this app uses)
pnpm dlx shadcn@latest add @coss/style

# the specific primitives this app imports
pnpm dlx shadcn@latest add @coss/button @coss/input @coss/textarea \
  @coss/field @coss/select @coss/badge @coss/sheet @coss/spinner
```

That populates `src/components/ui/*`. (If you'd rather grab everything:
`pnpm dlx shadcn@latest add @coss/ui`.)

> coss ui is in early access and built on Base UI (also beta), so component
> APIs can shift. If an import name changes upstream, adjust the import in the
> matching file under `src/components/`.

## 3. Set up Airtable

Create a base with two tables:

**Artists**
| field | type |
|---|---|
| `name` | Single line text |
| `bio` | Long text |
| `nationality` | Single line text |

**Artworks**
| field | type |
|---|---|
| `title` | Single line text |
| `artist` | Link to **Artists** |
| `art_type` | Single select (Painting, Sculpture) |
| `year` | Single line text |
| `description` | Long text |
| `tags` | Multiple select |
| `image` | Attachment |

The image field **must** be named `image` (or change it in
`src/lib/airtable.js`). `typecast: true` is set on writes, so new
select/tag options are created automatically as you dictate them.

Create a **personal access token** (Airtable → Developer hub) with scopes
`data.records:read`, `data.records:write`, and access to this base. Grab the
**Base ID** (`app…`) from the base's API docs.

## 4. Configure secrets

API keys live **server-side** in Netlify Functions — never in the browser. Set
these environment variables (Netlify dashboard → Site settings → Environment
variables, and in a local `.env` for `netlify dev`):

| Var | What |
| --- | --- |
| `APP_PASSWORD` | Shared password the app prompts for; gates every `/api` call |
| `OPENAI_API_KEY` | Whisper transcription |
| `ANTHROPIC_API_KEY` | Claude transcript → fields |
| `AIRTABLE_TOKEN` | Airtable personal access token |
| `AIRTABLE_BASE_ID` | Airtable base id |

Optional overrides: `CLAUDE_MODEL`, `ARTISTS_TABLE`, `COLLECTIONS_TABLE`,
`ARTWORKS_TABLE`, `ARTWORKS_IMAGE_FIELD`. See `.env.example`.

In the app itself, the only thing a user enters is the **app password** — on
the login screen at launch (verified against `APP_PASSWORD` via `/api/verify`).
It's stored in this device's `localStorage`, so it's entered once; **Settings →
Log out** clears it and returns to the login screen.

## 5. Run

```bash
cp .env.example .env   # fill in the vars above
pnpm dev:netlify       # netlify dev: Vite + the /api functions together
```

Use `pnpm dev:netlify` (not plain `pnpm dev`) so the `/api/*` functions run
locally. Camera, microphone, and PWA install all require **HTTPS** (or
`localhost`). On your phone over the LAN, use a tunnel (e.g.
`cloudflared tunnel --url …`) or deploy. To install to the home screen: open in
Safari/Chrome → Share → *Add to Home Screen*.

## 6. Deploy (Netlify)

Import the repo in Netlify; build settings come from `netlify.toml`
(`pnpm build` → `dist`, functions in `netlify/functions`, `/api/*` routed to
them). Set the environment variables from step 4 in the dashboard, then deploy.

---

## Security model

API keys are held only in Netlify env vars and used inside the functions in
`netlify/functions/` — they never reach the client bundle. The browser talks
only to our own `/api/*` endpoints, authenticated with the shared
`APP_PASSWORD` (sent as the `x-app-password` header, compared in constant time
server-side). Anyone with the password can use the app and spend your API
credits — rotate the env var if it leaks. This is a private-tool model, not
hardened multi-user auth; for that, swap the password gate for Netlify Identity
or similar.

---

## Project layout

```
netlify/functions/   server-side proxies (hold the API keys)
  _shared.js          auth gate + Airtable/env helpers
  transcribe.js       OpenAI Whisper
  parse.js            Anthropic (transcript → fields)
  artists.js          Airtable artists (list / create)
  collections.js      Airtable collections (list / create)
  artworks.js         Airtable artwork create
  upload-image.js     Airtable image attachment
  verify.js           password check for the login screen
src/
  lib/
    config.js       app-password storage + isConfigured()
    theme.js        light/dark theme get/set/apply (defaults dark)
    api.js          apiFetch() → /api/* with the password header
    airtable.js     artists + collections + artworks + image (via /api)
    transcribe.js   calls /api/transcribe
    parse.js        calls /api/parse
    opencv.js       OpenCV.js loader + perspective transform
    utils.js        cn()
  components/
    AuthScreen.jsx           login gate (verifies password, then unlocks)
    SessionHub.jsx           session list + New artwork
    CaptureWizard.jsx        owns the 3-step capture flow
    PerspectiveCropper.jsx   draggable-corner de-skew
    DescribeStep.jsx         voice capture (whole-clip + field-by-field)
    ReviewStep.jsx           review fields, confirm-as-you-go, save
    VoiceCapture.jsx         recorder hook + press-to-talk mic
    Settings.jsx             theme toggle + log out
    ui/                      ← coss ui components (added via CLI)
  App.jsx           auth gate, then hub ⇄ capture view switch
```
