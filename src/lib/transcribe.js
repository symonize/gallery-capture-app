import { getConfig } from "./config";

/*
  Transcribe an audio Blob (from MediaRecorder) using OpenAI Whisper.
  Browser -> OpenAI direct; CORS is permitted. Key is exposed (see config.js).
*/
export async function transcribe(blob) {
  const { openaiKey } = getConfig();
  if (!openaiKey) throw new Error("Missing OpenAI API key (Settings).");

  const form = new FormData();
  // Whisper infers format from the filename extension; webm/m4a both fine.
  const ext = blob.type.includes("mp4") || blob.type.includes("m4a") ? "m4a" : "webm";
  form.append("file", blob, `clip.${ext}`);
  form.append("model", "whisper-1");
  form.append("language", "en");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Whisper ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.text || "";
}
