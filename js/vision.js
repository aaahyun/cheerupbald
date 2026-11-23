// 브라우저 안에서만 도는 측정 파이프라인.
// 사진은 canvas로만 다루고 어디에도 전송하지 않는다. 네트워크는 모델·런타임 다운로드에만 쓴다.

const TASKS_VERSION = '0.10.14';
const TASKS_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}`;
const MAX_SIDE = 1024;

// 정수리 가이드 원: 이미지 중앙, 짧은 변의 0.84배 지름 (촬영 화면 일러스트와 같은 비율)
export const CROWN_CIRCLE = { radiusRatio: 0.42 };

export class QualityError extends Error {
  constructor(reason) { super(reason); this.reason = reason; }
}

// ───────────────────────── 모델 로드 ─────────────────────────
let modelsPromise = null;

export function loadModels() {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      const { FilesetResolver, FaceLandmarker, ImageSegmenter } = await import(`${TASKS_CDN}/vision_bundle.mjs`);
      const fileset = await FilesetResolver.forVisionTasks(`${TASKS_CDN}/wasm`);
      const url = (p) => new URL(p, document.baseURI).href;
      const [face, seg] = await Promise.all([
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: url('models/face_landmarker.task'), delegate: 'CPU' },
          runningMode: 'IMAGE',
          numFaces: 2,
        }),
        ImageSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: url('models/hair_segmenter.tflite'), delegate: 'CPU' },
          runningMode: 'IMAGE',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        }),
      ]);
      return { face, seg };
    })();
    modelsPromise.catch(() => { modelsPromise = null; }); // 실패하면 다음 호출에서 재시도
  }
  return modelsPromise;
}

// ───────────────────────── 이미지 전처리 ─────────────────────────
/** File → 긴 변 1024px canvas. EXIF 회전은 브라우저 디코더(from-image)로 보정. */
export async function fileToCanvas(file) {
  let source;
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    source = await new Promise((resolve, reject) => {
      const img = new Image();
      const u = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(u); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(u); reject(new QualityError('file')); };
      img.src = u;
    });
  }
  const sw = source.width, sh = source.height;
  if (!sw || !sh) throw new QualityError('file');
  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();
  return canvas;
}

// ───────────────────────── 픽셀 도우미 ─────────────────────────
function pixels(canvas) {
  return canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
}

function lumaAt(px, W, x, y) {
  const i = (Math.round(y) * W + Math.round(x)) * 4;
  return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
}

function isSkin(r, g, b) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cr = 128 + 0.5 * r - 0.4187 * g - 0.0813 * b;
  const cb = 128 - 0.1687 * r - 0.3313 * g + 0.5 * b;
  return y > 60 && cr >= 135 && cr <= 180 && cb >= 85 && cb <= 135;
}

async function segmentHair(seg, canvas) {
  return new Promise((resolve, reject) => {
    try {
      seg.segment(canvas, (result) => {
        const masks = result.confidenceMasks || [];
        const m = masks[masks.length > 1 ? 1 : 0]; // category 1 = hair
        resolve({ data: m.getAsFloat32Array().slice(), w: m.width, h: m.height });
      });
    } catch (e) { reject(e); }
  });
}

function maskSampler(mask, W, H) {
  return (x, y) => {
    const mx = Math.min(mask.w - 1, Math.max(0, Math.floor((x / W) * mask.w)));
    const my = Math.min(mask.h - 1, Math.max(0, Math.floor((y / H) * mask.h)));
    return mask.data[my * mask.w + mx];
  };
}

const deg = (r) => (r * 180) / Math.PI;
const add = (a, b, s = 1) => ({ x: a.x + b.x * s, y: a.y + b.y * s });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });

// MediaPipe Face Mesh 인덱스
const IDX = {
  browUpper: [70, 63, 105, 66, 107, 300, 293, 334, 296, 336],
  browLower: [46, 53, 52, 65, 55, 276, 283, 282, 295, 285],
  noseTip: 1,
  eyeOuterImgLeft: 33,   // 사진 왼쪽에 보이는 눈꼬리
  eyeOuterImgRight: 263, // 사진 오른쪽에 보이는 눈꼬리
  faceEdgeL: 234,
  faceEdgeR: 454,
  foreheadTop: 10,
  chin: 152,
};

// ───────────────────────── 정면 ─────────────────────────
/**
 * 정면 사진 측정. 품질 실패 시 QualityError(reason) 를 던진다.
 * 반환: { H, M, hairlineMissing, geom } — geom은 오버레이용 좌표. H = 이마 높이 ÷ U.
 */
export async function analyzeFront(canvas) {
  const { face, seg } = await loadModels();
  const W = canvas.width, H = canvas.height;
  const px = pixels(canvas);

  // 1) 전체 밝기
  let sum = 0, n = 0;
  for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) { sum += lumaAt(px, W, x, y); n++; }
  if (sum / n < 45) throw new QualityError('light');

  // 2) 얼굴 한 명
  const res = face.detect(canvas);
  if (!res.faceLandmarks || res.faceLandmarks.length !== 1) throw new QualityError('face');
  const lm = res.faceLandmarks[0];
  const P = (i) => ({ x: lm[i].x * W, y: lm[i].y * H, z: lm[i].z * W });

  // 3) 기울기: roll(눈 선), yaw(양 볼 깊이 차), pitch(이마–턱 깊이 차)
  const eL = P(IDX.eyeOuterImgLeft), eR = P(IDX.eyeOuterImgRight);
  const eyeLen = Math.hypot(eR.x - eL.x, eR.y - eL.y);
  const right = { x: (eR.x - eL.x) / eyeLen, y: (eR.y - eL.y) / eyeLen };
  const up = { x: right.y, y: -right.x };
  const roll = deg(Math.atan2(right.y, right.x));
  const fl = P(IDX.faceEdgeL), fr = P(IDX.faceEdgeR);
  const yaw = deg(Math.atan2(fr.z - fl.z, Math.hypot(fr.x - fl.x, fr.y - fl.y)));
  const ft = P(IDX.foreheadTop), ch = P(IDX.chin);
  const pitch = deg(Math.atan2(ch.z - ft.z, Math.hypot(ch.x - ft.x, ch.y - ft.y)));
  if (Math.abs(roll) > 15 || Math.abs(yaw) > 15 || Math.abs(pitch) > 20) throw new QualityError('tilt');

  // 4) 얼굴 밝기 / 역광
  let fs = 0;
  for (let i = 0; i < 468; i += 3) {
    const p = P(i);
    if (p.x >= 0 && p.y >= 0 && p.x < W && p.y < H) fs += lumaAt(px, W, p.x, p.y);
  }
  const faceLuma = fs / 156;
  let bs = 0, bn = 0;
  for (let y = 0; y < H; y += 8) {
    for (const x of [4, W - 5]) { bs += lumaAt(px, W, x, y); bn++; }
  }
  for (let x = 0; x < W; x += 8) { bs += lumaAt(px, W, x, 4); bn++; }
  const bgLuma = bs / bn;
  if (faceLuma < 60 || (faceLuma < 100 && bgLuma - faceLuma > 70)) throw new QualityError('light');

  // 5) 기준 길이 U = 눈썹 중앙 ~ 코끝 (얼굴 세로축으로 투영)
  const brows = [...IDX.browUpper, ...IDX.browLower].map(P);
  const browC = { x: brows.reduce((s, p) => s + p.x, 0) / brows.length, y: brows.reduce((s, p) => s + p.y, 0) / brows.length };
  const nose = P(IDX.noseTip);
  const U = dot(sub(browC, nose), up);
  if (!(U > 10)) throw new QualityError('face');

  // 6) 헤어라인 찾기: 눈썹 선에서 얼굴 위쪽 방향으로 훑어 올라가며 머리카락이 시작되는 지점
  const mask = await segmentHair(seg, canvas);
  const hairAt = maskSampler(mask, W, H);
  const MAX_T = 3.2; // U 배수. 이보다 높으면 이마 위로 머리카락이 없다고 본다
  const scan = (origin) => {
    const step = U * 0.02;
    let run = 0;
    for (let t = U * 0.2; t <= U * MAX_T; t += step) {
      const c = add(origin, up, t);
      if (c.x < 0 || c.y < 0 || c.x >= W || c.y >= H) return { out: true };
      let h = 0;
      for (const o of [-0.06, -0.03, 0, 0.03, 0.06]) {
        const q = add(c, right, U * o);
        h += hairAt(q.x, q.y);
      }
      if (h / 5 >= 0.5) {
        run += step;
        if (run >= U * 0.1) return { t: t - run + step };
      } else run = 0;
    }
    return { none: true };
  };

  const center = scan(browC);
  const sideOrigin = (eye) => add(browC, right, dot(sub(eye, browC), right));
  const geom = { W, H, U, browC, up, right, eyeL: eL, eyeR: eR, faceL: fl, faceR: fr };

  if (center.out) throw new QualityError('hairline'); // 이마 위가 잘림
  if (center.none) {
    // 이마 위로 머리카락이 없다 → 정수리 사진의 P로만 판정한다 (판정 규칙 5).
    return { H: null, M: null, hairlineMissing: true, geom };
  }
  const fh = center.t / U; // 이마 높이 지표 H
  if (fh < 0.55) throw new QualityError('hairline'); // 앞머리가 이마를 덮음

  const sides = [sideOrigin(eL), sideOrigin(eR)].map((o) => {
    const s = scan(o);
    return s.t != null ? s.t / U : null;
  });
  // 관자놀이 쪽이 눈썹 바로 위에서 머리카락에 막히면 옆 앞머리가 덮은 것
  if (sides.some((v) => v != null && v < 0.55)) throw new QualityError('hairline');
  const Ms = sides.filter((v) => v != null).map((v) => Math.max(0, v - fh));
  const M = Ms.length ? Math.max(...Ms) : null;

  geom.hairline = { center: fh, sideL: sides[0], sideR: sides[1] };
  return { H: fh, M, hairlineMissing: false, geom };
}

// ───────────────────────── 정수리 ─────────────────────────
/**
 * 정수리 사진 측정 (PRD v1.1: P·V율·T율).
 * 사진 위쪽이 이마 방향이고, 가마가 가이드 원 가운데 있다고 가정한다 (가이드에 안내).
 * 반환: { P, uPos, shape, V, T, vtConnected, grid } — grid는 오버레이용 격자와 좌표.
 */
export async function analyzeCrown(canvas) {
  const { seg } = await loadModels();
  const W = canvas.width, H = canvas.height;
  const px = pixels(canvas);
  const mask = await segmentHair(seg, canvas);
  const hairAt = maskSampler(mask, W, H);

  const cx = W / 2, cy = H / 2;
  const r = Math.min(W, H) * CROWN_CIRCLE.radiusRatio;
  const G = CROWN_GRID;
  const cell = (2 * r) / G;
  const grid = new Uint8Array(G * G); // CELL 값 참고
  let inCircle = 0, head = 0, lumaSum = 0, hx = 0, hy = 0;

  for (let gy = 0; gy < G; gy++) {
    for (let gx = 0; gx < G; gx++) {
      const x = cx - r + (gx + 0.5) * cell;
      const y = cy - r + (gy + 0.5) * cell;
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      inCircle++;
      const i = (Math.floor(y) * W + Math.floor(x)) * 4;
      const R = px[i], Gc = px[i + 1], B = px[i + 2];
      const Y = 0.299 * R + 0.587 * Gc + 0.114 * B;
      lumaSum += Y;
      const skin = isSkin(R, Gc, B);
      const hair = !skin && (hairAt(x, y) >= 0.5 || Y < 100);
      let v = CELL.bg;
      if (skin) v = CELL.scalp;
      else if (hair) v = CELL.hair;
      if (v !== CELL.bg) { head++; hx += gx; hy += gy; }
      grid[gy * G + gx] = v;
    }
  }

  if (lumaSum / inCircle < 55) throw new QualityError('light');
  if (head / inCircle < 0.55) throw new QualityError('circle');
  const off = Math.hypot(hx / head - G / 2, hy / head - G / 2) / (G / 2);
  if (off > 0.35) throw new QualityError('circle');

  const m = measureCrownGrid(grid, G);
  if (m.P == null) throw new QualityError('circle');
  return { ...m, grid: { data: grid, G, cx, cy, r, W, H, ...m.geom } };
}

export const CROWN_GRID = 160;
// 격자 칸 값: 0 원 밖, 1 배경, 2 머리카락, 3 두피, 4 앞머리 후퇴로 드러난 두피(기본형 몫)
export const CELL = { out: 0, bg: 1, hair: 2, scalp: 3, recession: 4 };
const V_RADIUS = 0.2; // 가마 원 반지름 (격자 한 변 대비)

/**
 * 격자만으로 P·V율·T율을 잰다 (DOM 없음, node 테스트 가능). grid를 제자리에서 고친다(후퇴 영역 = 4).
 *  - 가마 = 격자 가운데. 원래 헤어라인 = 각 열에서 머리가 시작되는 앞 윤곽.
 *  - 현재 헤어라인 = 앞 윤곽에서 뒤로 내려가며 처음 나오는 머리카락 띠(3칸 이상).
 *  - P = (현재 헤어라인 − 앞 윤곽) ÷ (가마 − 앞 윤곽) × 100, 가운데 띠 열들 중 가장 많이 후퇴한 쪽(80번째 백분위).
 */
export function measureCrownGrid(grid, G) {
  const at = (x, y) => grid[y * G + x];
  const vx = Math.floor(G / 2), vy = Math.floor(G / 2);
  const isHead = (v) => v === CELL.hair || v === CELL.scalp;

  // 가마 높이에서 머리 폭 → 가운데 띠(관자놀이까지)
  let left = -1, right = -1;
  for (let x = 0; x < G; x++) if (isHead(at(x, vy))) { if (left < 0) left = x; right = x; }
  if (left < 0) return { P: null };
  const hc = (left + right) / 2, hw = (right - left) / 2;
  const x0 = Math.max(0, Math.ceil(hc - hw * 0.5)), x1 = Math.min(G - 1, Math.floor(hc + hw * 0.5));

  const hairRow = new Int16Array(G).fill(-1);
  const cols = []; // { x, P, uPos }
  for (let x = x0; x <= x1; x++) {
    let front = -1, back = -1;
    for (let y = 0; y < G; y++) if (isHead(at(x, y))) { if (front < 0) front = y; back = y; }
    if (front < 0 || vy - front < G * 0.15) continue;
    let hl = back + 1;
    for (let y = front; y <= back - 2; y++) {
      if (at(x, y) === CELL.hair && at(x, y + 1) === CELL.hair && at(x, y + 2) === CELL.hair) { hl = y; break; }
    }
    hairRow[x] = hl;
    for (let y = front; y < hl && y < G; y++) if (at(x, y) === CELL.scalp) grid[y * G + x] = CELL.recession;
    const P = ((hl - front) / (vy - front)) * 100;
    const uPos = hl > vy ? ((hl - vy) / Math.max(1, back + 1 - vy)) * 100 : 0;
    cols.push({ x, P, uPos });
  }
  if (cols.length < 3) return { P: null };

  const pct = (arr, q) => { const a = [...arr].sort((p, q2) => p - q2); return a[Math.min(a.length - 1, Math.floor(a.length * q))]; };
  const P = pct(cols.map((c) => c.P), 0.8);
  const uCols = cols.filter((c) => c.uPos > 0);
  const uPos = uCols.length ? pct(uCols.map((c) => c.uPos), 0.5) : 0;

  // 후퇴 모양: 관자놀이 쪽이 가운데보다 10%p 이상 더 들어가면 M자
  const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  const centerP = mean(cols.filter((c) => Math.abs(c.x - hc) <= hw * 0.15).map((c) => c.P));
  const sideP = mean(cols.filter((c) => Math.abs(c.x - hc) >= hw * 0.3).map((c) => c.P));
  const shape = sideP - centerP >= 10 ? 'M' : 'C';

  // V율: 가마 원 안 / T율: 현재 헤어라인~가마 사이 윗머리 (가마 원 제외). 후퇴 영역(4)은 빼고 센다.
  const Rv = G * V_RADIUS;
  const inV = (x, y) => (x - vx) ** 2 + (y - vy) ** 2 <= Rv * Rv;
  const inT = (x, y) => x >= x0 && x <= x1 && hairRow[x] >= 0 && y >= hairRow[x] && y <= vy && !inV(x, y);
  let vHead = 0, vScalp = 0, tHead = 0, tScalp = 0;
  for (let y = 0; y < G; y++) {
    for (let x = 0; x < G; x++) {
      const v = at(x, y);
      if (v !== CELL.hair && v !== CELL.scalp) continue;
      if (inV(x, y)) { vHead++; if (v === CELL.scalp) vScalp++; }
      else if (inT(x, y)) { tHead++; if (v === CELL.scalp) tScalp++; }
    }
  }
  const V = vHead > G * G * 0.02 ? (vScalp / vHead) * 100 : 0;
  const T = tHead > G * G * 0.02 ? (tScalp / tHead) * 100 : 0;

  return {
    P, uPos, shape, V, T,
    vtConnected: vScalp > 0 && tScalp > 0 && scalpConnected(grid, G, inV, inT),
    geom: { vx, vy, Rv, x0, x1, hairRow },
  };
}

// 가마 원의 가장 큰 두피 덩어리가 윗머리 두피의 절반 이상을 덮으면 "이어져 있다"
function scalpConnected(grid, G, inV, inT) {
  const labels = new Int32Array(G * G).fill(-1);
  const stack = [];
  let id = 0;
  const vCount = [], tCount = [];
  let tTotal = 0;
  for (let s = 0; s < G * G; s++) {
    if (grid[s] !== CELL.scalp || labels[s] !== -1) continue;
    vCount[id] = 0; tCount[id] = 0;
    labels[s] = id; stack.push(s);
    while (stack.length) {
      const k = stack.pop();
      const x = k % G, y = (k / G) | 0;
      if (inV(x, y)) vCount[id]++;
      else if (inT(x, y)) { tCount[id]++; tTotal++; }
      for (const nk of [x > 0 ? k - 1 : -1, x < G - 1 ? k + 1 : -1, y > 0 ? k - G : -1, y < G - 1 ? k + G : -1]) {
        if (nk >= 0 && grid[nk] === CELL.scalp && labels[nk] === -1) { labels[nk] = id; stack.push(nk); }
      }
    }
    id++;
  }
  if (!tTotal) return false;
  let best = -1;
  for (let i = 0; i < id; i++) if (best < 0 || vCount[i] > vCount[best]) best = i;
  return best >= 0 && vCount[best] > 0 && tCount[best] / tTotal >= 0.5;
}
