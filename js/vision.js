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
 * 반환: { F, M, hairlineMissing, geom } — geom은 오버레이용 좌표.
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
  const MAX_T = 3.2; // U 배수. F 2.0 이상은 VI이므로 이 정도면 충분
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
    // 이마 위로 머리카락이 없다 → 헤어라인 없음(VII 후보). 정수리 결과를 보고 판단한다.
    return { F: null, M: null, hairlineMissing: true, geom };
  }
  const F = center.t / U;
  if (F < 0.55) throw new QualityError('hairline'); // 앞머리가 이마를 덮음

  const sides = [sideOrigin(eL), sideOrigin(eR)].map((o) => {
    const s = scan(o);
    return s.t != null ? s.t / U : null;
  });
  // 관자놀이 쪽이 눈썹 바로 위에서 머리카락에 막히면 옆 앞머리가 덮은 것
  if (sides.some((v) => v != null && v < 0.55)) throw new QualityError('hairline');
  const Ms = sides.filter((v) => v != null).map((v) => Math.max(0, v - F));
  const M = Ms.length ? Math.max(...Ms) : null;

  geom.hairline = { center: F, sideL: sides[0], sideR: sides[1] };
  return { F, M, hairlineMissing: false, geom };
}

// ───────────────────────── 정수리 ─────────────────────────
/**
 * 정수리 사진 측정.
 * 반환: { C, B, part, grid } — grid는 오버레이용 두피 픽셀 격자.
 * 사진 위쪽이 이마 방향이라고 가정한다 (가이드에 안내).
 */
export async function analyzeCrown(canvas) {
  const { seg } = await loadModels();
  const W = canvas.width, H = canvas.height;
  const px = pixels(canvas);
  const mask = await segmentHair(seg, canvas);
  const hairAt = maskSampler(mask, W, H);

  const cx = W / 2, cy = H / 2;
  const r = Math.min(W, H) * CROWN_CIRCLE.radiusRatio;
  const G = 160; // 격자 해상도
  const cell = (2 * r) / G;
  // 0: 원 밖, 1: 배경, 2: 머리카락, 3: 두피
  const grid = new Uint8Array(G * G);
  let inCircle = 0, head = 0, scalp = 0, lumaSum = 0, hx = 0, hy = 0;

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
      let v = 1;
      if (skin) { v = 3; scalp++; }
      else if (hair) v = 2;
      if (v >= 2) { head++; hx += gx; hy += gy; }
      grid[gy * G + gx] = v;
    }
  }

  if (lumaSum / inCircle < 55) throw new QualityError('light');
  const headFrac = head / inCircle;
  if (headFrac < 0.55) throw new QualityError('circle');
  const off = Math.hypot(hx / head - G / 2, hy / head - G / 2) / (G / 2);
  if (off > 0.35) throw new QualityError('circle');

  const C = (scalp / head) * 100;
  const B = C < 15 ? 'present' : bandState(grid, G);
  const part = partingWidth(grid, G);
  return { C, B, part, grid: { data: grid, G, cx, cy, r, W, H } };
}

// 앞쪽(원 위쪽 15%)에 닿은 두피 영역과 정수리(중앙) 두피 영역 사이의 머리 띠 두께
function bandState(grid, G) {
  const labels = new Int32Array(G * G).fill(-1);
  const sizes = [];
  const touchesFront = [];
  const stack = [];
  for (let s = 0; s < G * G; s++) {
    if (grid[s] !== 3 || labels[s] !== -1) continue;
    const id = sizes.length;
    let size = 0, front = false;
    labels[s] = id; stack.push(s);
    while (stack.length) {
      const k = stack.pop();
      size++;
      const x = k % G, y = (k / G) | 0;
      if (y < G * 0.15) front = true;
      for (const nk of [x > 0 ? k - 1 : -1, x < G - 1 ? k + 1 : -1, y > 0 ? k - G : -1, y < G - 1 ? k + G : -1]) {
        if (nk >= 0 && grid[nk] === 3 && labels[nk] === -1) { labels[nk] = id; stack.push(nk); }
      }
    }
    sizes.push(size); touchesFront.push(front);
  }
  const minSize = G * G * 0.01;
  // 정수리 영역: 중앙에서 가장 가까운 충분히 큰 덩어리
  let crownId = -1, best = Infinity;
  for (let k = 0; k < G * G; k++) {
    const id = labels[k];
    if (id < 0 || sizes[id] < minSize) continue;
    const d = Math.hypot((k % G) - G / 2, ((k / G) | 0) - G / 2);
    if (d < best) { best = d; crownId = id; }
  }
  if (crownId < 0 || best > G * 0.3) return 'present';
  const frontIds = new Set(sizes.map((s, id) => (touchesFront[id] && s >= minSize ? id : -1)).filter((v) => v >= 0));
  if (frontIds.size === 0) return 'present';
  if (frontIds.has(crownId)) return 'none';

  // 앞쪽 영역에서 출발해 정수리 영역까지 BFS 거리
  const dist = new Int32Array(G * G).fill(-1);
  const q = new Int32Array(G * G);
  let head = 0, tail = 0;
  for (let k = 0; k < G * G; k++) if (frontIds.has(labels[k])) { dist[k] = 0; q[tail++] = k; }
  let gap = Infinity;
  while (head < tail) {
    const k = q[head++];
    if (labels[k] === crownId) { gap = dist[k]; break; }
    const x = k % G, y = (k / G) | 0;
    for (const nk of [x > 0 ? k - 1 : -1, x < G - 1 ? k + 1 : -1, y > 0 ? k - G : -1, y < G - 1 ? k + G : -1]) {
      if (nk >= 0 && grid[nk] !== 0 && dist[nk] === -1) { dist[nk] = dist[k] + 1; q[tail++] = nk; }
    }
  }
  const g = gap / G;
  if (g < 0.06) return 'none';
  if (g < 0.15) return 'thin';
  return 'present';
}

// 가르마 폭 (원 지름 대비 %). 세로·가로 중 두피 줄기가 더 길게 이어지는 방향을 가르마로 본다.
function partingWidth(grid, G) {
  const measure = (vertical) => {
    const widths = [];
    let hit = 0, lines = 0;
    for (let a = Math.floor(G * 0.25); a < G * 0.75; a++) {
      lines++;
      let bestW = 0, bestD = Infinity, run = 0, start = 0;
      for (let b = 0; b <= G; b++) {
        const v = b < G ? (vertical ? grid[a * G + b] : grid[b * G + a]) : 0;
        if (v === 3) { if (run === 0) start = b; run++; }
        else if (run > 0) {
          const mid = start + run / 2;
          const d = Math.abs(mid - G / 2);
          if (d < G * 0.3 && d < bestD) { bestD = d; bestW = run; }
          run = 0;
        }
      }
      if (bestW > 0) { hit++; widths.push(bestW); }
    }
    if (hit / lines < 0.3) return { coverage: hit / lines, width: 0 };
    widths.sort((x, y) => x - y);
    const width = widths[widths.length >> 1];
    // 가르마는 길고 가는 줄기. 둥근 정수리 탈모 부위(폭 ≈ 길이)는 가르마로 치지 않는다 (C가 담당).
    if (hit < width * 3) return { coverage: hit / lines, width: 0 };
    return { coverage: hit / lines, width };
  };
  const v = measure(true);  // 행마다 가로 폭 → 세로로 뻗은 가르마
  const h = measure(false);
  const pick = v.coverage >= h.coverage ? v : h;
  return (pick.width / G) * 100;
}
