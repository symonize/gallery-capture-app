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

/* ---------- geometry helpers for quad scoring ---------- */

function centroid(p) {
  return {
    x: (p[0].x + p[1].x + p[2].x + p[3].x) / 4,
    y: (p[0].y + p[1].y + p[2].y + p[3].y) / 4,
  };
}

// Shoelace area (order-independent magnitude).
function polyArea(p) {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    a += p[i].x * p[j].y - p[j].x * p[i].y;
  }
  return Math.abs(a) / 2;
}

// True if the 4 points form a convex quad (all cross products same sign).
function isConvexQuad(pts) {
  const o = orderPoints(pts);
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = o[i];
    const b = o[(i + 1) % 4];
    const c = o[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross !== 0) {
      const s = Math.sign(cross);
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}

// 0..1: how rectangular the quad is (opposite sides similar length + ~90° corners).
function rectangularity(pts) {
  const o = orderPoints(pts);
  const len = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const sides = [
    len(o[0], o[1]),
    len(o[1], o[2]),
    len(o[2], o[3]),
    len(o[3], o[0]),
  ];
  if (sides.some((s) => s < 1)) return 0;
  const wRatio = Math.min(sides[0], sides[2]) / Math.max(sides[0], sides[2]);
  const hRatio = Math.min(sides[1], sides[3]) / Math.max(sides[1], sides[3]);
  // Corner angles near 90°.
  let angleScore = 0;
  for (let i = 0; i < 4; i++) {
    const a = o[(i + 3) % 4];
    const b = o[i];
    const c = o[(i + 1) % 4];
    const v1 = { x: a.x - b.x, y: a.y - b.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const cos = dot / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
    angleScore += 1 - Math.abs(cos); // 1 when perpendicular
  }
  angleScore /= 4;
  return (wRatio + hRatio) / 2 * 0.5 + angleScore * 0.5;
}

// Approximate median gray value (0..255) for auto Canny thresholds.
function medianGray(cv, gray) {
  try {
    const hist = new cv.Mat();
    const mask = new cv.Mat();
    const srcVec = new cv.MatVector();
    srcVec.push_back(gray);
    cv.calcHist(srcVec, [0], mask, hist, [256], [0, 256]);
    const total = gray.rows * gray.cols;
    let cum = 0;
    let median = 128;
    for (let i = 0; i < 256; i++) {
      cum += hist.data32F[i];
      if (cum >= total / 2) {
        median = i;
        break;
      }
    }
    hist.delete();
    mask.delete();
    srcVec.delete();
    return median;
  } catch {
    return 128;
  }
}

// Rotated bounding box (4 corners) of the largest contour above minArea.
function largestMinAreaRect(cv, blurGray, minArea) {
  let edges, contours, hierarchy, best;
  try {
    edges = new cv.Mat();
    cv.Canny(blurGray, edges, 50, 150);
    const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
    cv.dilate(edges, edges, kernel);
    kernel.delete();
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    let bestArea = minArea;
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const area = cv.contourArea(c);
      if (area > bestArea) {
        bestArea = area;
        if (best) best.delete();
        best = c.clone();
      }
      c.delete();
    }
    if (!best) return null;
    const rot = cv.minAreaRect(best);
    const pts = cv.RotatedRect.points(rot);
    return pts.map((p) => ({ x: p.x, y: p.y }));
  } catch {
    return null;
  } finally {
    best?.delete();
    edges?.delete();
    contours?.delete();
    hierarchy?.delete();
  }
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

  const frameArea = dw * dh;
  const minArea = frameArea * 0.1; // ignore quads smaller than 10% of frame
  const cx = dw / 2;
  const cy = dh / 2;

  // Score a candidate quad: bigger, more rectangular, and more centered is
  // better. Returns -Infinity for rejects.
  const scoreQuad = (pts) => {
    const area = polyArea(pts);
    if (area < minArea) return -Infinity;
    if (!isConvexQuad(pts)) return -Infinity;
    // Rectangularity: how close opposite sides are in length + corners to 90°.
    const rect = rectangularity(pts);
    if (rect < 0.55) return -Infinity;
    // Centeredness: penalize quads whose centroid is far from image center.
    const c = centroid(pts);
    const off = Math.hypot(c.x - cx, c.y - cy) / Math.hypot(cx, cy);
    return area / frameArea + rect * 0.5 - off * 0.4;
  };

  let src, gray, blur;
  const temps = [];
  try {
    src = cv.imread(work);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    blur = new cv.Mat();
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);

    // Auto Canny thresholds from the image median, plus fixed fallbacks —
    // different lighting needs different sensitivity.
    const med = medianGray(cv, gray);
    const autoLo = Math.max(0, Math.round(0.66 * med));
    const autoHi = Math.min(255, Math.round(1.33 * med));
    const cannyPairs = [
      [autoLo, autoHi],
      [50, 150],
      [30, 90],
      [75, 200],
    ];

    let bestPts = null;
    let bestScore = -Infinity;

    for (const [lo, hi] of cannyPairs) {
      const edges = new cv.Mat();
      temps.push(edges);
      cv.Canny(blur, edges, lo, hi);
      const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
      cv.dilate(edges, edges, kernel);
      kernel.delete();

      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      temps.push(hierarchy);
      cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      for (let i = 0; i < contours.size(); i++) {
        const c = contours.get(i);
        const peri = cv.arcLength(c, true);
        // Try a few approximation tolerances per contour.
        for (const eps of [0.02, 0.04, 0.06]) {
          const approx = new cv.Mat();
          cv.approxPolyDP(c, approx, eps * peri, true);
          if (approx.rows === 4) {
            const d = approx.data32S;
            const pts = [
              { x: d[0], y: d[1] },
              { x: d[2], y: d[3] },
              { x: d[4], y: d[5] },
              { x: d[6], y: d[7] },
            ];
            const s = scoreQuad(pts);
            if (s > bestScore) {
              bestScore = s;
              bestPts = pts;
            }
          }
          approx.delete();
        }
        c.delete();
      }
      contours.delete();

      // A strong, well-centered hit early lets us stop scanning more thresholds.
      if (bestScore > 0.7) break;
    }

    // Fallback: rotated bounding box of the largest contour — always 4 corners,
    // a solid starting guess even when no clean quad was approximated.
    if (!bestPts) {
      bestPts = largestMinAreaRect(cv, blur, minArea);
    }

    if (bestPts && bestPts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
      // Scale detection-space points back to natural image coordinates.
      const scaled = bestPts.map((p) => ({ x: p.x / ratio, y: p.y / ratio }));
      return orderPoints(scaled);
    }
    return inset(0.08, 0.08);
  } catch {
    return inset(0.08, 0.08);
  } finally {
    src?.delete();
    gray?.delete();
    blur?.delete();
    temps.forEach((m) => m?.delete());
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
