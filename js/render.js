// 오버레이·단계 일러스트·결과 카드. 일러스트는 자체 제작한 단순 SVG (정식 일러스트가 나오면 교체).
import { STAGES, SERVICE_NAME } from './content.js';
import { REPRESENTATIVE } from './judge.js';

// ───────────────────────── 단계 일러스트 ─────────────────────────
const HAIRLINE = { // 단계별 헤어라인: 중앙 높이 yc, 관자놀이 높이 yt (작을수록 위)
  1: { yc: 80, yt: 76 },
  2: { yc: 80, yt: 66 },
  3: { yc: 76, yt: 54 },
  4: { yc: 62, yt: 47 },
};

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
function hairlinePoints(geom, F, M) {
  const { browC, right, up, U, eyeL, eyeR, faceL, faceR } = geom;
  const lat = (p) => ((p.x - browC.x) * right.x + (p.y - browC.y) * right.y) / U;
  const sL = lat(eyeL), sR = lat(eyeR), eL = lat(faceL), eR = lat(faceR);
  const pts = [
    [eL * 0.98, (F + M) * 0.45],
    [sL, F + M],
    [sL * 0.45, F + M * 0.25],
    [0, F],
    [sR * 0.45, F + M * 0.25],
    [sR, F + M],
    [eR * 0.98, (F + M) * 0.45],
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
 * 정면 오버레이. variant 'A' = 내 단계 선 1개, 'B' = 5단계 선 전부 + "나는 여기".
 * female이면 측정된 내 헤어라인을 그린다 (루드비히는 앞머리 후퇴 기준이 아님).
 */
export function drawFrontOverlay(photo, front, stage, variant, female) {
  const { geom } = front;
  const c = document.createElement('canvas');
  c.width = photo.width; c.height = photo.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(photo, 0, 0);
  const scale = Math.max(photo.width, photo.height) / 1024 * 1.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const drawStage = (s, F, M, width, alpha, label) => {
    const pts = hairlinePoints(geom, F, M);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = width + 4 * scale;
    smoothLine(ctx, pts);
    ctx.strokeStyle = STAGES[s].color;
    ctx.lineWidth = width;
    smoothLine(ctx, pts);
    ctx.globalAlpha = 1;
    if (label) tag(ctx, label, pts[3].x, pts[3].y - 30 * scale, STAGES[s].color, scale);
  };

  if (female) {
    if (front.F != null) drawStage(stage, front.F, front.M ?? 0, 5 * scale, 1, '내 헤어라인');
  } else if (variant === 'B') {
    for (let s = 1; s <= 5; s++) {
      if (s !== stage) drawStage(s, REPRESENTATIVE[s].F, REPRESENTATIVE[s].M, 2.5 * scale, 0.75, null);
    }
    drawStage(stage, REPRESENTATIVE[stage].F, REPRESENTATIVE[stage].M, 6 * scale, 1, `나는 여기 · ${stage}단계`);
  } else {
    drawStage(stage, REPRESENTATIVE[stage].F, REPRESENTATIVE[stage].M, 6 * scale, 1, `${stage}단계 헤어라인`);
  }
  return c;
}

// ───────────────────────── 정수리 오버레이 ─────────────────────────
export function drawCrownOverlay(photo, crown, stage) {
  const { data, G, cx, cy, r } = crown.grid;
  const size = Math.round(2 * r);
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(photo, cx - r, cy - r, size, size, 0, 0, size, size);
  const cell = size / G;
  ctx.fillStyle = STAGES[stage].color;
  ctx.globalAlpha = 0.5;
  for (let y = 0; y < G; y++) {
    for (let x = 0; x < G; x++) {
      if (data[y * G + x] === 3) ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
    }
  }
  ctx.restore();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(3, size / 120);
  ctx.setLineDash([size / 40, size / 60]);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r - ctx.lineWidth, 0, Math.PI * 2);
  ctx.stroke();
  return c;
}

// ───────────────────────── 스토리 카드 1080×1920 ─────────────────────────
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

/** 공유용 결과 카드. 본인 사진·진행 가능성은 넣지 않는다. */
export async function drawStoryCard(stage, siteLabel) {
  try { await document.fonts.ready; } catch { /* 폰트 없이 진행 */ }
  const st = STAGES[stage];
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const font = (w, s) => `${w} ${s}px Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif`;

  ctx.fillStyle = '#FFF8EE';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = st.color;
  ctx.globalAlpha = 0.14;
  ctx.beginPath(); ctx.arc(W / 2, 820, 430, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#5B4B3F';
  ctx.font = font(700, 54);
  ctx.fillText(SERVICE_NAME, W / 2, 230);

  const img = await svgToImage(stageSVG(stage, { size: 640 }));
  ctx.drawImage(img, W / 2 - 320, 500, 640, 640);

  // 단계 배지
  ctx.fillStyle = st.color;
  ctx.beginPath(); ctx.roundRect(W / 2 - 150, 330, 300, 100, 50); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = font(800, 56);
  ctx.fillText(`${stage}단계`, W / 2, 400);

  ctx.fillStyle = '#2B211B';
  ctx.font = font(900, 150);
  ctx.fillText(st.name, W / 2, 1340);
  ctx.fillStyle = '#5B4B3F';
  ctx.font = font(600, 60);
  wrapText(ctx, st.tone, W - 160).forEach((l, i) => ctx.fillText(l, W / 2, 1450 + i * 76));

  // 5단계 눈금
  const barY = 1620, barW = 640, gap = 16, seg = (barW - gap * 4) / 5;
  for (let s = 1; s <= 5; s++) {
    ctx.fillStyle = s <= stage ? STAGES[stage].color : '#E9DCCB';
    ctx.beginPath(); ctx.roundRect(W / 2 - barW / 2 + (s - 1) * (seg + gap), barY, seg, 22, 11); ctx.fill();
  }

  ctx.fillStyle = '#8C7B6D';
  ctx.font = font(500, 36);
  ctx.fillText('나도 테스트하기 → ' + siteLabel, W / 2, 1780);
  ctx.font = font(400, 28);
  ctx.fillText('재미로 보는 참고용 테스트예요', W / 2, 1836);
  return c;
}
