// 오버레이·단계 일러스트·결과 카드. 일러스트는 자체 제작한 단순 SVG (정식 일러스트가 나오면 교체).
import { STAGES, SERVICE_NAME } from './content.js';
import { REPRESENTATIVE } from './judge.js';
import { CELL } from './vision.js';

// ───────────────────────── 단계 일러스트 ─────────────────────────
const HAIRLINE = { // 단계별 헤어라인: 중앙 높이 yc, 관자놀이 높이 yt (작을수록 위)
  1: { yc: 80, yt: 76 },
  2: { yc: 80, yt: 66 },
  3: { yc: 76, yt: 54 },
  4: { yc: 62, yt: 47 },
};

// 단계 일러스트 이미지 (달걀 캐릭터, image/ 원본을 잘라 assets/stages/ 에 둠).
// 아직 그림이 없는 레벨은 아래 stageSVG 로 대신 그린다.
export const STAGE_IMAGES = {
  1: 'assets/stages/stage-1.webp',
  2: 'assets/stages/stage-2.webp',
  3: 'assets/stages/stage-3.webp',
  4: 'assets/stages/stage-4.webp',
  5: 'assets/stages/stage-5.webp',
};

// 달걀 사진 가장자리를 스튜디오 배경에 녹이는 마스크 (원형 크롭 대신)
export const EGG_MASK = 'radial-gradient(50% 50% at 50% 50%, #000 78%, transparent 100%)';

/** 단계 일러스트 HTML. base: 페이지에서 앱 루트까지의 상대 경로 (예: '../../'). */
export function stageArt(stage, { size = 200, base = '', cls = '' } = {}) {
  const src = STAGE_IMAGES[stage];
  if (!src) return stageSVG(stage, { size });
  return `<img class="stage-img ${cls}" src="${base}${src}" width="${size}" height="${size}" alt="" decoding="async" style="-webkit-mask-image:${EGG_MASK};mask-image:${EGG_MASK}">`;
}

/** 5단계 달걀 라인업. me: 내 레벨(없으면 강조 없음). */
export function eggLineup(me = 0, { base = '', names = true } = {}) {
  return `<ol class="lineup">${[1, 2, 3, 4, 5].map((s) => `
    <li class="egg-slot${s === me ? ' is-me' : ''}" data-stage="${s}">
      <span class="egg-pic">${stageArt(s, { size: 120, base })}</span>
      ${names ? `<span class="egg-name"><b>${String(s).padStart(2, '0')}</b>${STAGES[s].name}</span>` : ''}
    </li>`).join('')}</ol>`;
}

/** 단계별 얼굴 일러스트 SVG 문자열 (viewBox 200×200). */
export function stageSVG(stage, { size = 200 } = {}) {
  const hairColor = '#3B2A22';
  const skin = '#F5D2B3';
  let hair;
  if (stage <= 4) {
    const { yc, yt } = HAIRLINE[stage];
    hair = `<path fill="${hairColor}" d="M40,128 C34,70 62,40 100,40 C138,40 166,70 160,128 L152,128 L152,${yt + 14}
      Q151,${yt} 138,${yt} Q118,${yt} 100,${yc} Q82,${yt} 62,${yt} Q49,${yt} 48,${yt + 14} L48,128 Z"/>`;
    if (stage === 4) hair += `<ellipse cx="100" cy="47" rx="14" ry="5" fill="${skin}"/>`;
  } else {
    hair = `<path fill="${hairColor}" d="M40,132 C36,108 40,92 48,84 C52,100 54,116 54,132 Z"/>
      <path fill="${hairColor}" d="M160,132 C164,108 160,92 152,84 C148,100 146,116 146,132 Z"/>
      <path d="M78,58 Q88,50 100,49" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".7"/>`;
  }
  const eyes = stage === 5
    ? `<rect x="62" y="104" width="32" height="16" rx="6" fill="#1d1d1f"/><rect x="106" y="104" width="32" height="16" rx="6" fill="#1d1d1f"/><rect x="92" y="108" width="16" height="4" fill="#1d1d1f"/>`
    : `<circle cx="80" cy="112" r="5" fill="#1d1d1f"/><circle cx="120" cy="112" r="5" fill="#1d1d1f"/>`;
  const mouth = {
    1: '<path d="M86,140 Q100,152 114,140" stroke="#1d1d1f" stroke-width="4" fill="none" stroke-linecap="round"/>',
    2: '<path d="M88,142 Q100,148 112,142" stroke="#1d1d1f" stroke-width="4" fill="none" stroke-linecap="round"/>',
    3: '<path d="M89,144 L111,144" stroke="#1d1d1f" stroke-width="4" stroke-linecap="round"/>',
    4: '<path d="M88,146 Q100,138 112,146" stroke="#1d1d1f" stroke-width="4" fill="none" stroke-linecap="round"/>',
    5: '<path d="M84,138 Q100,156 116,138 Z" fill="#1d1d1f"/>',
  }[stage];
  const sweat = stage === 4 ? '<path d="M150,80 q8,12 0,18 q-8,-6 0,-18Z" fill="#7FC8F8"/>' : '';
  const sparkle = stage === 5 ? '<path d="M150,46 l4,10 10,4 -10,4 -4,10 -4,-10 -10,-4 10,-4z" fill="#FFD43B"/>' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}">
    <ellipse cx="38" cy="118" rx="10" ry="15" fill="${skin}"/><ellipse cx="162" cy="118" rx="10" ry="15" fill="${skin}"/>
    <ellipse cx="100" cy="112" rx="60" ry="72" fill="${skin}"/>
    ${hair}${eyes}${mouth}
    <ellipse cx="68" cy="132" rx="9" ry="5" fill="#F29E9E" opacity=".55"/><ellipse cx="132" cy="132" rx="9" ry="5" fill="#F29E9E" opacity=".55"/>
    ${sweat}${sparkle}
  </svg>`;
}

// ───────────────────────── 정면 오버레이 ─────────────────────────
// H = 가운데 헤어라인 높이, M = 관자놀이가 가운데보다 더 올라간 정도 (음수면 가운데가 더 높은 반원형)
function hairlinePoints(geom, H, M) {
  const { browC, right, up, U, eyeL, eyeR, faceL, faceR } = geom;
  const lat = (p) => ((p.x - browC.x) * right.x + (p.y - browC.y) * right.y) / U;
  const sL = lat(eyeL), sR = lat(eyeR), eL = lat(faceL), eR = lat(faceR);
  const pts = [
    [eL * 0.98, (H + M) * 0.45],
    [sL, H + M],
    [sL * 0.45, H + M * 0.25],
    [0, H],
    [sR * 0.45, H + M * 0.25],
    [sR, H + M],
    [eR * 0.98, (H + M) * 0.45],
  ];
  return pts.map(([s, h]) => ({
    x: browC.x + right.x * s * U + up.x * h * U,
    y: browC.y + right.y * s * U + up.y * h * U,
  }));
}

function smoothLine(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
      p2.x, p2.y,
    );
  }
  ctx.stroke();
}

function tag(ctx, text, x, y, color, scale) {
  ctx.font = `700 ${Math.round(22 * scale)}px Pretendard, system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 20 * scale, h = 34 * scale;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
}

/**
 * 정면 오버레이. 기본형이 M·C형이면 유형·등급별 대표 헤어라인을 그린다.
 *  variant 'A' = 내 등급 선 1개, 'B' = 등급 0~3 선 전부 + "나는 여기".
 * L·U형이거나 대표값이 없으면 측정된 내 헤어라인을 그린다.
 */
export function drawFrontOverlay(photo, front, judged, variant) {
  const { geom } = front;
  const c = document.createElement('canvas');
  c.width = photo.width; c.height = photo.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(photo, 0, 0);
  if (front.hairlineMissing) return c;
  const scale = Math.max(photo.width, photo.height) / 1024 * 1.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const drawLine = (level, H, M, width, alpha, label) => {
    const pts = hairlinePoints(geom, H, M);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = width + 4 * scale;
    smoothLine(ctx, pts);
    ctx.strokeStyle = STAGES[level].color;
    ctx.lineWidth = width;
    smoothLine(ctx, pts);
    ctx.globalAlpha = 1;
    if (label) tag(ctx, label, pts[3].x, pts[3].y - 30 * scale, STAGES[level].color, scale);
  };

  const { type, grade } = judged.basic;
  const reps = REPRESENTATIVE[type];
  if (type !== 'M' && type !== 'C') {
    drawLine(judged.basic.level, front.H, front.M ?? 0, 5 * scale, 1, '내 헤어라인');
  } else if (variant === 'B') {
    for (let g = 0; g <= 3; g++) if (g !== grade) drawLine(g + 1, reps[g].H, reps[g].M, 2.5 * scale, 0.75, null);
    drawLine(grade + 1, reps[grade].H, reps[grade].M, 6 * scale, 1, `나는 여기 · 레벨 ${grade + 1}`);
  } else {
    drawLine(grade + 1, reps[grade].H, reps[grade].M, 6 * scale, 1, `레벨 ${grade + 1} 헤어라인`);
  }
  return c;
}

// ───────────────────────── 정수리 오버레이 ─────────────────────────
/** 두피 노출 영역을 반투명으로 칠하고, 유형별로 가마 원(V)·윗머리 띠(F)·현재 헤어라인(M/C/U)을 표시한다. */
export function drawCrownOverlay(photo, crown, judged) {
  const { data, G, cx, cy, r, vx, vy, Rv, x0, x1, hairRow } = crown.grid;
  const size = Math.round(2 * r);
  const cell = size / G;
  const color = STAGES[judged.level].color;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(photo, cx - r, cy - r, size, size, 0, 0, size, size);
  ctx.fillStyle = color;
  for (let y = 0; y < G; y++) {
    for (let x = 0; x < G; x++) {
      const v = data[y * G + x];
      if (v !== CELL.scalp && v !== CELL.recession) continue;
      ctx.globalAlpha = v === CELL.recession ? 0.35 : 0.55;
      ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  const lw = Math.max(3, size / 120);
  const P = (gx, gy) => [(gx + 0.5) * cell, (gy + 0.5) * cell];
  const marks = new Set([judged.rep, ...judged.extra]);
  ctx.lineCap = 'round';

  if (judged.basic.type !== 'L') {
    // 현재 헤어라인
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = lw * 1.4;
    ctx.beginPath();
    let started = false;
    for (let x = x0; x <= x1; x++) {
      if (hairRow[x] < 0) continue;
      const [px, py] = P(x, Math.min(G - 1, hairRow[x]));
      if (started) ctx.lineTo(px, py); else { ctx.moveTo(px, py); started = true; }
    }
    ctx.stroke();
  }
  ctx.setLineDash([size / 40, size / 70]);
  ctx.lineWidth = lw;
  ctx.strokeStyle = '#fff';
  if (marks.has('V')) {
    const [px, py] = P(vx, vy);
    ctx.beginPath(); ctx.arc(px, py, Rv * cell, 0, Math.PI * 2); ctx.stroke();
  }
  if (marks.has('F')) {
    const top = Math.min(...[...hairRow].filter((v, x) => x >= x0 && x <= x1 && v >= 0));
    const [ax, ay] = P(x0, top), [bx, by] = P(x1, vy);
    ctx.strokeRect(ax, ay, bx - ax, by - ay);
  }
  ctx.setLineDash([]);
  // 가마 위치
  const [gx, gy] = P(vx, vy);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(gx, gy, lw * 1.6, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = lw;
  ctx.setLineDash([size / 40, size / 60]);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r - lw, 0, Math.PI * 2);
  ctx.stroke();
  return c;
}

// ───────────────────────── 스토리 카드 1080×1920 ─────────────────────────
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function svgToImage(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

/** 달걀 사진을 가장자리가 녹아드는 캔버스로 (EGG_MASK 와 같은 모양) */
function featheredEgg(img, size, { mute = false } = {}) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  if (mute) {
    // 흑백 + 옅게 (ctx.filter 미지원 브라우저도 같은 결과가 나도록 직접 계산)
    const d = ctx.getImageData(0, 0, size, size);
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const y = p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11;
      p[i] = p[i + 1] = p[i + 2] = y;
    }
    ctx.putImageData(d, 0, 0);
  }
  ctx.globalCompositeOperation = 'destination-in';
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.78, '#000');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/** 공유용 결과 카드 ('표본 포스터'). 본인 사진·진행 가능성은 넣지 않는다. */
export async function drawStoryCard(stage, siteLabel, root = document.baseURI) {
  try { await document.fonts.ready; } catch { /* 폰트 없이 진행 */ }
  const st = STAGES[stage];
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const font = (w, s) => `${w} ${s}px Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif`;
  const INK = '#141414', INK2 = '#4A4A4C', INK3 = '#6B6B6E';

  // 스튜디오 배경지: 위는 밝고 아래로 갈수록 어두워진다
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#EEEEEF');
  bg.addColorStop(0.55, '#DCDCDE');
  bg.addColorStop(1, '#CDCDD0');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // 레벨 색 틴트 (결과에서만 쓰는 유일한 색)
  const tint = ctx.createRadialGradient(W / 2, 640, 0, W / 2, 640, 640);
  tint.addColorStop(0, st.color + '33');
  tint.addColorStop(1, st.color + '00');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, W, H);

  // 상단 라벨
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.fillRect(80, 120, W - 160, 3);
  ctx.font = font(700, 30);
  ctx.textAlign = 'left';
  ctx.fillText('SPECIMEN REPORT', 80, 176);
  ctx.textAlign = 'right';
  ctx.fillText(`LV.${String(stage).padStart(2, '0')} / 05`, W - 80, 176);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK2;
  ctx.font = font(700, 40);
  ctx.fillText(SERVICE_NAME, W / 2, 262);

  // 대형 달걀
  let egg;
  if (STAGE_IMAGES[stage]) egg = await loadImage(new URL(STAGE_IMAGES[stage], root).href);
  else egg = await svgToImage(stageSVG(stage, { size: 720 }));
  const ES = 760;
  ctx.drawImage(featheredEgg(egg, ES), W / 2 - ES / 2, 300);

  // 레벨 칩
  ctx.font = font(800, 40);
  const chip = `레벨 ${stage} / 5`;
  const cw = ctx.measureText(chip).width + 104;
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.beginPath(); ctx.roundRect(W / 2 - cw / 2, 1080, cw, 76, 38); ctx.fill();
  ctx.fillStyle = st.color;
  ctx.beginPath(); ctx.arc(W / 2 - cw / 2 + 42, 1118, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillText(chip, W / 2 + 16, 1132);

  ctx.font = font(900, 168);
  ctx.fillText(st.name, W / 2, 1340);
  ctx.fillStyle = INK2;
  ctx.font = font(600, 52);
  wrapText(ctx, st.tone, W - 200).forEach((l, i) => ctx.fillText(l, W / 2, 1430 + i * 68));

  // 5단계 라인업
  const imgs = await Promise.all([1, 2, 3, 4, 5].map((s) => (STAGE_IMAGES[s]
    ? loadImage(new URL(STAGE_IMAGES[s], root).href) : svgToImage(stageSVG(s, { size: 200 })))));
  const LS = 168, gap = 8, total = LS * 5 + gap * 4, x0 = (W - total) / 2, y0 = 1540;
  imgs.forEach((im, i) => {
    const me = i + 1 === stage;
    ctx.globalAlpha = me ? 1 : 0.5;
    ctx.drawImage(featheredEgg(im, LS, { mute: !me }), x0 + i * (LS + gap), y0);
    ctx.globalAlpha = 1;
    if (me) {
      ctx.fillStyle = st.color;
      ctx.beginPath(); ctx.roundRect(x0 + i * (LS + gap) + 44, y0 + LS + 4, LS - 88, 8, 4); ctx.fill();
    }
  });

  ctx.fillStyle = INK;
  ctx.fillRect(80, 1770, W - 160, 2);
  ctx.font = font(700, 34);
  ctx.textAlign = 'left';
  ctx.fillText('나도 테스트하기 →', 80, 1830);
  ctx.textAlign = 'right';
  ctx.fillStyle = INK3;
  ctx.font = font(500, 30);
  ctx.fillText(siteLabel, W - 80, 1830);
  ctx.textAlign = 'center';
  ctx.font = font(500, 26);
  ctx.fillText('재미로 보는 참고용 테스트예요', W / 2, 1880);
  return c;
}
