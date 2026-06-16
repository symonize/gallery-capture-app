import { json, requireAuth, env } from "./_shared.js";

/*
  Proxy OpenAI Whisper. Client POSTs JSON { audioBase64, ext } (the audio blob
  base64-encoded). We rebuild the multipart form server-side so the OpenAI key
  stays on the server.
*/
export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only." });
  const auth = requireAuth(event);
  if (auth) return auth;

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }
  const { audioBase64, ext = "webm" } = payload;
  if (!audioBase64) return json(400, { error: "Missing audioBase64." });

  const buf = Buffer.from(audioBase64, "base64");
  const type = ext === "m4a" ? "audio/mp4" : "audio/webm";

  const form = new FormData();
  form.append("file", new Blob([buf], { type }), `clip.${ext}`);
  form.append("model", "whisper-1");
  form.append("language", "en");

  let res;
  try {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}` },
      body: form,
    });
  } catch (e) {
    return json(502, { error: `Whisper request failed: ${e.message}` });
  }
  if (!res.ok) {
    return json(res.status, { error: `Whisper ${res.status}: ${await res.text()}` });
  }
  const data = await res.json();
  return json(200, { text: data.text || "" });
}
