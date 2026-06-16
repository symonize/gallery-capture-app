import { apiFetch } from "./api";

// Read a Blob as a bare base64 string (no data: prefix).
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/*
  Transcribe an audio Blob (from MediaRecorder) via our /api/transcribe
  function, which proxies OpenAI Whisper server-side. No API key in the client.
*/
export async function transcribe(blob) {
  const ext =
    blob.type.includes("mp4") || blob.type.includes("m4a") ? "m4a" : "webm";
  const audioBase64 = await blobToBase64(blob);
  const data = await apiFetch("transcribe", {
    method: "POST",
    body: { audioBase64, ext },
  });
  return data.text || "";
}
