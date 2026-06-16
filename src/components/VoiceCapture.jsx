import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// Pick a mime type the browser actually supports (Safari = mp4, others = webm).
function pickMime() {
  const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const t of opts) {
    if (window.MediaRecorder?.isTypeSupported?.(t)) return t;
  }
  return "";
}

export function useRecorder() {
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const [recording, setRecording] = useState(false);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mimeType = pickMime();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.start();
    recRef.current = rec;
    setRecording(true);
  }, []);

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const rec = recRef.current;
      if (!rec) return resolve(null);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        resolve(blob);
      };
      rec.stop();
    });
  }, []);

  return { recording, start, stop };
}

/*
  Press-and-hold mic button. onComplete(blob) fires on release.
  `busy` shows a spinner while the parent processes the clip.
*/
export function MicButton({ onComplete, busy, label = "Hold to talk", size }) {
  const { recording, start, stop } = useRecorder();
  const [err, setErr] = useState("");

  async function down(e) {
    e.preventDefault();
    setErr("");
    try {
      await start();
    } catch {
      setErr("Microphone permission denied.");
    }
  }
  async function up(e) {
    e.preventDefault();
    if (!recording) return;
    const blob = await stop();
    if (blob) onComplete(blob);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size={size}
        variant={recording ? "destructive" : "secondary"}
        onMouseDown={down}
        onMouseUp={up}
        onMouseLeave={(e) => recording && up(e)}
        onTouchStart={down}
        onTouchEnd={up}
        disabled={busy}
        className="touch-none select-none"
      >
        {busy ? (
          <>
            <Spinner className="mr-2" /> Transcribing…
          </>
        ) : recording ? (
          "● Recording — release to stop"
        ) : (
          `🎤 ${label}`
        )}
      </Button>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
}
