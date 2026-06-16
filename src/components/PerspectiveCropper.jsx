import { useEffect, useRef, useState, useCallback } from "react";
import { loadOpenCV, detectQuad, warpToFlat } from "@/lib/opencv";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/*
  Shows the captured photo with 4 draggable corner handles (auto-detected as a
  starting guess). On confirm, runs a four-point perspective transform and
  returns a flattened JPEG data URL via onConfirm(dataUrl).

  Display is scaled to fit the viewport; handle positions are stored in the
  image's natural pixel space and mapped to/from display space on the fly.
*/
export default function PerspectiveCropper({ imageUrl, onConfirm, onSkip, onRetake }) {
  const imgRef = useRef(null);
  const wrapRef = useRef(null);
  const cvRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [display, setDisplay] = useState({ w: 0, h: 0 });
  const [corners, setCorners] = useState(null); // [{x,y}] in natural px
  const dragging = useRef(null);

  // Load OpenCV once.
  useEffect(() => {
    let alive = true;
    loadOpenCV()
      .then((cv) => {
        if (!alive) return;
        cvRef.current = cv;
        setReady(true);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  // When both the image and OpenCV are ready, auto-detect corners.
  const onImgLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNatural({ w, h });
    measure();
    if (cvRef.current) {
      try {
        const quad = detectQuad(cvRef.current, img);
        setCorners(quad);
      } catch {
        setCorners(insetCorners(w, h));
      }
    } else {
      setCorners(insetCorners(w, h));
    }
  }, []);

  useEffect(() => {
    if (ready && imgRef.current?.complete && !corners) onImgLoad();
  }, [ready, corners, onImgLoad]);

  function insetCorners(w, h) {
    return [
      { x: w * 0.08, y: h * 0.08 },
      { x: w * 0.92, y: h * 0.08 },
      { x: w * 0.92, y: h * 0.92 },
      { x: w * 0.08, y: h * 0.92 },
    ];
  }

  function measure() {
    const img = imgRef.current;
    if (img) setDisplay({ w: img.clientWidth, h: img.clientHeight });
  }
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const scale = display.w && natural.w ? display.w / natural.w : 1;

  // Pointer handling for the corner handles.
  function pointerDown(i) {
    return (e) => {
      e.preventDefault();
      dragging.current = i;
    };
  }
  function pointerMove(e) {
    if (dragging.current == null) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const dx = (point.clientX - rect.left) / scale;
    const dy = (point.clientY - rect.top) / scale;
    const x = Math.max(0, Math.min(natural.w, dx));
    const y = Math.max(0, Math.min(natural.h, dy));
    setCorners((prev) => {
      const next = [...prev];
      next[dragging.current] = { x, y };
      return next;
    });
  }
  function pointerUp() {
    dragging.current = null;
  }

  function confirm() {
    if (!cvRef.current || !corners) return;
    setWorking(true);
    // defer so the spinner paints before the (sync) warp blocks the thread
    requestAnimationFrame(() => {
      try {
        const canvas = warpToFlat(cvRef.current, imgRef.current, corners);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        onConfirm(dataUrl);
      } catch (e) {
        setError(e.message);
      } finally {
        setWorking(false);
      }
    });
  }

  const polyPoints =
    corners?.map((c) => `${c.x * scale},${c.y * scale}`).join(" ") || "";

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-muted-foreground">
        Drag the corners to the edges of the artwork, then straighten.
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div
        ref={wrapRef}
        className="relative mx-auto touch-none select-none"
        onMouseMove={pointerMove}
        onMouseUp={pointerUp}
        onMouseLeave={pointerUp}
        onTouchMove={pointerMove}
        onTouchEnd={pointerUp}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Captured artwork"
          onLoad={onImgLoad}
          className="block max-h-[60vh] w-auto max-w-full rounded-md"
          draggable={false}
        />

        {corners && (
          <svg
            className="pointer-events-none absolute inset-0"
            width={display.w}
            height={display.h}
          >
            <polygon
              points={polyPoints}
              fill="rgba(56,189,248,0.15)"
              stroke="rgb(56,189,248)"
              strokeWidth="2"
            />
          </svg>
        )}

        {corners?.map((c, i) => (
          <div
            key={i}
            onMouseDown={pointerDown(i)}
            onTouchStart={pointerDown(i)}
            className="absolute z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white bg-sky-400 shadow-md active:cursor-grabbing"
            style={{ left: c.x * scale, top: c.y * scale }}
          />
        ))}

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Spinner /> <span className="ml-2 text-sm">Loading de-skew…</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={confirm} disabled={!ready || working}>
          {working ? <Spinner className="mr-2" /> : null}
          Straighten &amp; use
        </Button>
        <Button variant="outline" onClick={() => onSkip(imageUrl)}>
          Use as-is (skip)
        </Button>
        <Button variant="ghost" onClick={onRetake}>
          Retake
        </Button>
      </div>
    </div>
  );
}
