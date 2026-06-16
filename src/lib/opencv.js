/*
  Client-side perspective correction with OpenCV.js (WASM).
  - loadOpenCV(): lazy-loads the runtime once, cached by the service worker.
  - detectQuad(): best-guess four corners of the artwork (initial handles).
  - warpToFlat(): four-point transform -> flattened, cropped rectangle.

  Coordinates throughout are in the source image's natural pixel space.
*/

// Official OpenCV.js builds. opencv.org occasionally removes old version dirs
// (4.10.0 vanished -> 404), so we try a primary then fall back to a CDN mirror.
const OPENCV_URLS = [
  "https://docs.opencv.org/4.9.0/opencv.js",
  "https://cdn.jsdelivr.net/npm/opencv.js@1.2.1/opencv.js",
];
let loadPromise = null;

// OpenCV.js is an Emscripten module: the script loads quickly but the WASM
// runtime initializes asynchronously afterward. The reliable signal is
// window.cv.Mat becoming available, announced via Module.onRuntimeInitialized.
function loadScript(url) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let poll;
    let timeout;

    const succeed = (cv) => {
      if (settled) return;
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

    // Instance whose .Mat we wait for, set once init is announced/observed.
    let instance = null;
    const check = () => {
      const cv = instance || window.cv;
      if (cv && cv.Mat) succeed(cv);
    };

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => {
      const cv = window.cv;
      if (cv && cv.Mat) return succeed(cv); // already initialized
      if (cv && typeof cv.then === "function") {
        return cv.then(succeed).catch((e) => fail(e.message)); // promise build
      }
      if (typeof cv === "function") {
        // opencv.org UMD: window.cv is the factory. Invoke it with a Module
        // carrying the runtime-ready hook; the resolved instance has .Mat.
        try {
          instance = cv({ onRuntimeInitialized: check });
          if (instance && typeof instance.then === "function") {
            instance.then(succeed).catch((e) => fail(e.message));
          }
        } catch (e) {
          return fail(`OpenCV init threw: ${e.message}`);
        }
      }
      // else: wait for the poll to observe cv.Mat
    };
    script.onerror = () => fail(`Failed to load ${url}`);

    // Fallback: poll for .Mat in case the init callback is missed.
    poll = setInterval(check, 150);
    timeout = setTimeout(
      () => fail(`${url} loaded but OpenCV never initialized`),
      25000,
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

// Returns 4 {x,y} in image pixel space. Falls back to an inset rectangle.
export function detectQuad(cv, imgEl) {
  const w = imgEl.naturalWidth || imgEl.width;
  const h = imgEl.naturalHeight || imgEl.height;
  const inset = (sx, sy) => [
    { x: w * sx, y: h * sy },
    { x: w * (1 - sx), y: h * sy },
    { x: w * (1 - sx), y: h * (1 - sy) },
    { x: w * sx, y: h * (1 - sy) },
  ];

  let src, gray, blur, edges, contours, hierarchy;
  try {
    src = cv.imread(imgEl);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    blur = new cv.Mat();
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    edges = new cv.Mat();
    cv.Canny(blur, edges, 75, 200);
    const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
    cv.dilate(edges, edges, kernel);
    kernel.delete();

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let best = null;
    let bestArea = (w * h) * 0.15; // ignore anything smaller than 15% of frame
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const peri = cv.arcLength(c, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(c, approx, 0.02 * peri, true);
      if (approx.rows === 4) {
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
        pts.push({ x: d[i * 2], y: d[i * 2 + 1] });
      }
      best.delete();
      if (pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
        return orderPoints(pts);
      }
    }
    return inset(0.08, 0.08);
  } catch {
    return inset(0.08, 0.08);
  } finally {
    src?.delete();
    gray?.delete();
    blur?.delete();
    edges?.delete();
    contours?.delete();
    hierarchy?.delete();
  }
}

// Four-point transform. `points` = 4 {x,y} in image pixel space (any order).
// Returns an HTMLCanvasElement with the flattened artwork.
export function warpToFlat(cv, imgEl, points) {
  const [tl, tr, br, bl] = orderPoints(points);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const maxW = Math.max(dist(br, bl), dist(tr, tl));
  const maxH = Math.max(dist(tr, br), dist(tl, bl));
  const W = Math.round(maxW);
  const H = Math.round(maxH);

  const src = cv.imread(imgEl);
  const dst = new cv.Mat();
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y,
  ]);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0, W, 0, W, H, 0, H,
  ]);
  const M = cv.getPerspectiveTransform(srcTri, dstTri);
  cv.warpPerspective(src, dst, M, new cv.Size(W, H), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  cv.imshow(out, dst);

  src.delete();
  dst.delete();
  srcTri.delete();
  dstTri.delete();
  M.delete();
  return out;
}
