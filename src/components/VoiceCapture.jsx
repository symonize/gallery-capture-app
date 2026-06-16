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
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const [recording, setRecording] = useState(false);
  // 0..1 live mic loudness, for the in-button waveform animation.
  const [level, setLevel] = useState(0);

  const teardownMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setLevel(0);
  }, []);

  const startMeter = useCallback((stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return; // no Web Audio — button falls back to idle pulse
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const sourceNode = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      sourceNode.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        // RMS amplitude around the 128 midpoint -> 0..1.
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Smooth and boost so normal speech reads as a lively level.
        setLevel((prev) => prev * 0.6 + Math.min(1, rms * 3.5) * 0.4);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* metering is best-effort; recording still works without it */
    }
  }, []);

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
    startMeter(stream);
  }, [startMeter]);

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const rec = recRef.current;
      if (!rec) return resolve(null);

      const finish = () => {
        teardownMeter();
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
  }, [teardownMeter]);

  return { recording, level, start, stop };
}

// Minimum hold to count as a real recording (ms). Below this, Whisper rejects
// the clip as too short, so we surface a friendly hint instead of erroring.
const MIN_RECORD_MS = 400;

/*
  Press-and-hold mic button. onComplete(blob) fires on release.
  `busy` shows a spinner while the parent processes the clip.
*/
// Live audio bars: heights driven by the mic level, with a per-bar idle wobble
// so it always looks alive even in silence.
const BARS = [0.45, 0.8, 1, 0.65, 0.9, 0.55];
function Waveform({ level }) {
  return (
    <span className="mr-2 inline-flex h-4 items-center gap-[2px] align-middle">
      {BARS.map((peak, i) => {
        // Base idle height + audio-reactive height, scaled per bar.
        const h = 18 + Math.min(1, level * peak) * 82;
        return (
          <span
            key={i}
            className="w-[3px] rounded-full bg-current"
            style={{
              height: `${h}%`,
              transition: "height 80ms ease-out",
              animation: `mic-bar 900ms ease-in-out ${i * 110}ms infinite`,
            }}
          />
        );
      })}
    </span>
  );
}

export function MicButton({ onComplete, busy, label = "Hold to talk", size }) {
  const { recording, level, start, stop } = useRecorder();
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
        className={
          "touch-none select-none transition-transform duration-150 " +
          (recording
            ? "scale-105 shadow-lg ring-2 ring-destructive/40"
            : "active:scale-95")
        }
      >
        {busy ? (
          <>
            <Spinner className="mr-2" /> Transcribing…
          </>
        ) : recording ? (
          <>
            <Waveform level={level} />
            Recording — release to stop
          </>
        ) : (
          `🎤 ${label}`
        )}
      </Button>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
}
