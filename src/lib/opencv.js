/*
  Client-side perspective correction with OpenCV.js (WASM).
  - loadOpenCV(): lazy-loads the runtime once, cached by the service worker.
  - detectQuad(): best-guess four corners of the artwork (initial handles).
  - warpToFlat(): four-point transform -> flattened, cropped rectangle.

  Coordinates throughout are in the source image's natural pixel space.
*/

const OPENCV_URL = "https://docs.opencv.org/4.10.0/opencv.js";
let loadPromise = null;

export function loadOpenCV() {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (window.cv && window.cv.Mat) return resolve(window.cv);
    const script = document.createElement("script");
    script.src = OPENCV_URL;
    script.async = true;
    script.onload = () => {
      const cv = window.cv;
      if (cv && cv.Mat) return resolve(cv);
      // Newer builds expose a promise or an init callback.
      if (cv instanceof Promise) {
        cv.then(resolve).catch(reject);
      } else if (cv) {
        cv.onRuntimeInitialized = () => resolve(cv);
      } else {
        reject(new Error("OpenCV failed to initialize"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load OpenCV.js"));
    document.body.appendChild(script);
  });
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
      const pts = [];
      for (let i = 0; i < 4; i++) {
        pts.push({ x: best.intAt(i, 0), y: best.intAt(i, 1) });
      }
      best.delete();
      return orderPoints(pts);
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
