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

## 4. Add your keys

Open the app, tap **Settings**, and paste: OpenAI key (Whisper), Anthropic key
(Claude), Airtable token, and Base ID. They're stored in this device's
`localStorage`. For local dev you can instead copy `.env.example` to `.env`.

## 5. Run

```bash
pnpm dev          # then open the printed LAN URL on your phone
```

Camera, microphone, and PWA install all require **HTTPS** (or `localhost`). On
your phone over the LAN, use a tunnel (e.g. `cloudflared tunnel --url …`) or
deploy. To install to the home screen: open in Safari/Chrome → Share → *Add to
Home Screen*.

## 6. Deploy

Any static host works (Netlify, Vercel, Cloudflare Pages):

```bash
pnpm build        # outputs dist/
```

---

## ⚠️ Security note — keys in the browser

This is a **pure client-side** app, so the OpenAI / Anthropic / Airtable keys
live in the browser and are visible to anyone with the device or devtools.
That's a fine tradeoff for a personal capture tool **you** run. **Do not** ship
it to gallery staff or the public as-is.

### Upgrade path (when others will use it)

Move the three API calls behind serverless functions and have the client call
those instead. All key access is isolated to `src/lib/{transcribe,parse,airtable}.js`,
so this is a localized change. Example Netlify function:

```js
// netlify/functions/parse.js
export default async (req) => {
  const { transcript } = await req.json();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,   // server-side, never shipped
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1024, messages: [{ role: "user", content: transcript }] }),
  });
  return new Response(await r.text(), { headers: { "content-type": "application/json" } });
};
```

Then point `parse.js` at `/.netlify/functions/parse` instead of Anthropic
directly, and do the same for Whisper and Airtable. Keys move to environment
variables on the host and never reach the client.

---

## Project layout

```
src/
  lib/
    config.js       key storage + getters
    airtable.js     artists + artworks + image upload
    transcribe.js   Whisper
    parse.js        Claude transcript → fields
    opencv.js       OpenCV.js loader + perspective transform
    utils.js        cn()
  components/
    PerspectiveCropper.jsx   draggable-corner de-skew
    VoiceCapture.jsx         recorder hook + press-to-talk mic
    CaptureForm.jsx          fields, voice modes, save
    Settings.jsx             keys sheet
    ui/                      ← coss ui components (added via CLI)
  App.jsx           capture → crop → form flow
```
