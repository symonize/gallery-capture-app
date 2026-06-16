/*
  Client-side perspective correction with OpenCV.js (WASM).
  - loadOpenCV(): lazy-loads the runtime once, cached by the service worker.
  - detectQuad(): best-guess four corners of the artwork (initial handles).
  - warpToFlat(): four-point transform -> flattened, cropped rectangle.

  Coordinates throughout are in the source image's natural pixel space.
*/

// OpenCV.js WASM build with the wasm binary inlined (no external .wasm to
// fetch — the opencv.org 4.x builds reference an opencv_js.wasm that 404s, and
// the 8MB asm.js build stalls iOS Safari). This @techstark build is immutable,
// CORS-enabled, and exposes window.cv as a thenable whose resolved value has
// .Mat once the runtime is ready.
const OPENCV_URLS = [
  "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.11.0-release.1/dist/opencv.js",
];
let loadPromise = null;

function loadScript(url) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let poll;
    let timeout;

    const succeed = (cv) => {
      if (settled) return;
      if (!cv || !cv.Mat) return; // not actually ready yet
      settled = true;
      clearInterval(poll);
      clearTimeout(timeout);
      resolve(cv);
    };
    const fail = (msg) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timeout);
      reject(new Error(msg));
    };

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => {
      const cv = window.cv;
      if (cv && cv.Mat) return succeed(cv); // already initialized
      // @techstark: window.cv is a thenable; its RESOLVED value carries .Mat
      // (window.cv itself never gains .Mat — must use the awaited value).
      if (cv && typeof cv.then === "function") {
        cv.then((resolved) => succeed(resolved?.Mat ? resolved : window.cv)).catch(
          (e) => fail(e.message),
        );
        return;
      }
      // opencv.org UMD fallback: window.cv is the factory function.
      if (typeof cv === "function") {
        try {
          const inst = cv({ onRuntimeInitialized: () => succeed(inst) });
          if (inst && typeof inst.then === "function") {
            inst.then(succeed).catch((e) => fail(e.message));
          }
        } catch (e) {
          return fail(`OpenCV init threw: ${e.message}`);
        }
      }
      // else: the poll below will catch a late window.cv.Mat
    };
    script.onerror = () => fail(`Failed to load ${url}`);

    // Fallback poll in case the init signal is missed.
    poll = setInterval(() => succeed(window.cv), 150);
    timeout = setTimeout(
      () => fail(`${url} loaded but OpenCV never initialized`),
      20000,
    );

    document.body.appendChild(script);
  });
}

export function loadOpenCV() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (window.cv && window.cv.Mat) return window.cv;
    let lastErr;
    for (const url of OPENCV_URLS) {
      try {
        return await loadScript(url);
      } catch (e) {
        lastErr = e;
      }
    }
    // Reset so a later retry can attempt the load again.
    loadPromise = null;
    throw new Error(
      `Couldn't load the de-skew engine (OpenCV.js). ${lastErr?.message || ""}`,
    );
  })();
  return loadPromise;
}

// Order 4 points as [topLeft, topRight, bottomRight, bottomLeft].
function orderPoints(pts) {
  const sum = (p) => p.x + p.y;
  const diff = (p) => p.y - p.x;
  const sorted = [...pts];
  const tl = sorted.reduce((a, b) => (sum(b) < sum(a) ? b : a));
  const br = sorted.reduce((a, b) => (sum(b) > sum(a) ? b : a));
  const tr = sorted.reduce((a, b) => (diff(b) < diff(a) ? b : a));
  const bl = sorted.reduce((a, b) => (diff(b) > diff(a) ? b : a));
  return [tl, tr, br, bl];
}

// Returns 4 {x,y} in the image's natural pixel space. Falls back to an inset
// rectangle if no convincing quad is found. Detection runs on a downscaled copy
// (full-res phone photos are huge — slow and can exhaust iOS memory), then the
// detected corners are scaled back to natural coordinates.
export function detectQuad(cv, imgEl) {
  const w = imgEl.naturalWidth || imgEl.width;
  const h = imgEl.naturalHeight || imgEl.height;
  const inset = (sx, sy) => [
    { x: w * sx, y: h * sy },
    { x: w * (1 - sx), y: h * sy },
    { x: w * (1 - sx), y: h * (1 - sy) },
    { x: w * sx, y: h * (1 - sy) },
  ];

  // Downscale so the longest side is ~1000px for detection.
  const MAX = 1000;
  const ratio = Math.min(1, MAX / Math.max(w, h));
  const dw = Math.max(1, Math.round(w * ratio));
  const dh = Math.max(1, Math.round(h * ratio));

  let work;
  try {
    work = document.createElement("canvas");
    work.width = dw;
    work.height = dh;
    work.getContext("2d").drawImage(imgEl, 0, 0, dw, dh);
  } catch {
    return inset(0.08, 0.08);
  }

  let src, gray, blur, edges, kernel, contours, hierarchy, best;
  try {
    src = cv.imread(work);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    blur = new cv.Mat();
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    edges = new cv.Mat();
    cv.Canny(blur, edges, 50, 150); // a bit more sensitive than 75/200
    kernel = cv.Mat.ones(5, 5, cv.CV_8U);
    cv.dilate(edges, edges, kernel);

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let bestArea = dw * dh * 0.1; // ignore anything smaller than 10% of frame
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const peri = cv.arcLength(c, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(c, approx, 0.02 * peri, true);
      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        const area = cv.contourArea(approx);
        if (area > bestArea) {
          bestArea = area;
          if (best) best.delete();
          best = approx.clone();
        }
      }
      approx.delete();
      c.delete();
    }

    if (best) {
      // approxPolyDP returns CV_32SC2 (2 channels). Read x,y from the flat
      // int32 buffer (data32S) — intAt(row,col) is unreliable for 2-channel.
      const d = best.data32S;
      const pts = [];
      for (let i = 0; i < 4; i++) {
        // Scale detection-space points back to natural image coordinates.
        pts.push({ x: d[i * 2] / ratio, y: d[i * 2 + 1] / ratio });
      }
      if (pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
        return orderPoints(pts);
      }
    }
    return inset(0.08, 0.08);
  } catch {
    return inset(0.08, 0.08);
  } finally {
    best?.delete();
    kernel?.delete();
    src?.delete();
    gray?.delete();
    blur?.delete();
    edges?.delete();
    contours?.delete();
    hierarchy?.delete();
  }
}

// Four-point transform. `points` = 4 {x,y} in the image's natural pixel space.
// Returns an HTMLCanvasElement with the flattened artwork.
//
// The source is downscaled to a capped size before the warp: a full-res phone
// photo (12MP) and/or a large output Size make warpPerspective produce an empty
// (black) result on iOS Safari due to memory limits. ~1600px on the long edge
// is plenty for cataloging.
export function warpToFlat(cv, imgEl, points) {
  const natW = imgEl.naturalWidth || imgEl.width;
  const natH = imgEl.naturalHeight || imgEl.height;

  const MAX = 1600;
  const ratio = Math.min(1, MAX / Math.max(natW, natH));
  const sw = Math.max(1, Math.round(natW * ratio));
  const sh = Math.max(1, Math.round(natH * ratio));

  // Render the source into a capped-size canvas; scale the corner points to match.
  const work = document.createElement("canvas");
  work.width = sw;
  work.height = sh;
  work.getContext("2d").drawImage(imgEl, 0, 0, sw, sh);

  const [tl, tr, br, bl] = orderPoints(points).map((p) => ({
    x: p.x * ratio,
    y: p.y * ratio,
  }));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // Cap output so neither side exceeds MAX either.
  let W = Math.round(Math.max(dist(br, bl), dist(tr, tl)));
  let H = Math.round(Math.max(dist(tr, br), dist(tl, bl)));
  const outRatio = Math.min(1, MAX / Math.max(W, H));
  W = Math.max(1, Math.round(W * outRatio));
  H = Math.max(1, Math.round(H * outRatio));

  let src, dst, srcTri, dstTri, M;
  try {
    src = cv.imread(work);
    dst = new cv.Mat();
    srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y,
    ]);
    dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, W, 0, W, H, 0, H]);
    M = cv.getPerspectiveTransform(srcTri, dstTri);
    cv.warpPerspective(
      src,
      dst,
      M,
      new cv.Size(W, H),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(),
    );

    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    cv.imshow(out, dst);
    return out;
  } finally {
    src?.delete();
    dst?.delete();
    srcTri?.delete();
    dstTri?.delete();
    M?.delete();
  }
}
