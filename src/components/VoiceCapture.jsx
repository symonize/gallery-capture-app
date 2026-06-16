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
  const startedAtRef = useRef(0);
  const [recording, setRecording] = useState(false);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mimeType = pickMime();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    // timeslice: emit chunks periodically so a short hold still captures audio
    // (without it, ondataavailable only fires at stop and can yield nothing).
    rec.start(250);
    recRef.current = rec;
    startedAtRef.current = Date.now();
    setRecording(true);
  }, []);

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const rec = recRef.current;
      if (!rec) return resolve(null);

      const finish = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recRef.current = null;
        setRecording(false);
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        const durationMs = Date.now() - startedAtRef.current;
        resolve({ blob, durationMs });
      };

      rec.onstop = finish;
      // Pull any final buffered audio before stopping, then stop.
      try {
        rec.requestData?.();
      } catch {
        /* not all browsers support requestData */
      }
      // Give the recorder a tick to flush the last chunk on a quick release.
      setTimeout(() => {
        if (rec.state !== "inactive") rec.stop();
        else finish();
      }, 120);
    });
  }, []);

  return { recording, start, stop };
}

// Minimum hold to count as a real recording (ms). Below this, Whisper rejects
// the clip as too short, so we surface a friendly hint instead of erroring.
const MIN_RECORD_MS = 400;

/*
  Press-and-hold mic button. onComplete(blob) fires on release.
  `busy` shows a spinner while the parent processes the clip.
*/
export function MicButton({ onComplete, busy, label = "Hold to talk", size }) {
  const { recording, start, stop } = useRecorder();
  const [err, setErr] = useState("");
  const startingRef = useRef(false);
  const pendingStopRef = useRef(false);

  async function down(e) {
    e.preventDefault();
    setErr("");
    startingRef.current = true;
    pendingStopRef.current = false;
    try {
      await start();
      startingRef.current = false;
      // If the user already released during the async getUserMedia, stop now.
      if (pendingStopRef.current) {
        pendingStopRef.current = false;
        await finishRecording();
      }
    } catch {
      startingRef.current = false;
      setErr("Microphone permission denied.");
    }
  }

  async function up(e) {
    e.preventDefault();
    // Released before start() resolved — defer the stop until it does.
    if (startingRef.current) {
      pendingStopRef.current = true;
      return;
    }
    if (!recording) return;
    await finishRecording();
  }

  async function finishRecording() {
    const result = await stop();
    if (!result) return;
    const { blob, durationMs } = result;
    if (!blob || blob.size === 0 || durationMs < MIN_RECORD_MS) {
      setErr("Too short — press and hold while you speak.");
      return;
    }
    setErr("");
    onComplete(blob);
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
