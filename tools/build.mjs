// 정적 공유 페이지 + OG 이미지 빌드.
//   SITE_URL=https://<id>.github.io/cheerupbald node tools/build.mjs
// 크롤러(카카오톡 등)는 JS를 실행하지 않으므로 단계별 HTML에 og:image를 박아 둔다.
import { writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { stageSVG } from '../js/render.js';
import { STAGES, SERVICE_NAME, DISCLAIMER } from '../js/content.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = (process.env.SITE_URL || 'https://YOUR_GITHUB_ID.github.io/cheerupbald').replace(/\/$/, '');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FONT = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css">`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// ── 1) 단계별 공유 페이지 ──
for (let s = 1; s <= 5; s++) {
  const st = STAGES[s];
  const title = `나는 ${s}단계 「${st.name}」 · ${SERVICE_NAME}`;
  const url = `${SITE_URL}/result/${s}/`;
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(st.tone)} — 사진 2장, 1분이면 끝. 나도 탈모 테스트 해보기">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(st.tone)} · 나도 1분 탈모 테스트 해보기">
  <meta property="og:image" content="${SITE_URL}/assets/og/stage-${s}.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#FFF8EE">
  <link rel="icon" href="../../assets/favicon.svg" type="image/svg+xml">
  ${FONT}
  <link rel="stylesheet" href="../../css/style.css">
</head>
<body data-stage="${s}">
<main id="app">
  <section class="screen">
    <div class="result-head">
      <p class="progress">친구의 탈모 테스트 결과</p>
      <div class="shared-art">${stageSVG(s, { size: 220 })}</div>
      <span class="badge" style="background:${st.color}">${s}단계</span>
      <h1 class="stage-name">${esc(st.name)}</h1>
      <p class="tone">${esc(st.tone)}</p>
    </div>
    <div class="meter">${[1, 2, 3, 4, 5].map((k) => `<i style="${k <= s ? `background:${st.color}` : ''}"></i>`).join('')}</div>
    <div class="meter-labels">${[1, 2, 3, 4, 5].map((k) => `<span class="${k === s ? 'me' : ''}">${STAGES[k].name}</span>`).join('')}</div>
    <div class="card"><h3>${s}단계는</h3><p>${esc(st.desc)}</p></div>
    <div class="bottom col">
      <a class="btn primary big" href="../../" data-action="cta">나도 테스트하기</a>
      <button class="btn" data-action="share">친구에게 공유하기</button>
    </div>
    <footer class="disclaimer">${esc(DISCLAIMER)}</footer>
  </section>
</main>
<div class="toast" id="toast" role="status" hidden></div>
<script type="module" src="../../js/shared.js"></script>
</body>
</html>
`;
  mkdirSync(join(ROOT, 'result', String(s)), { recursive: true });
  writeFileSync(join(ROOT, 'result', String(s), 'index.html'), html);
}

// /result/?stage=3 형태로 들어와도 단계 페이지로 보낸다
writeFileSync(join(ROOT, 'result', 'index.html'), `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>${SERVICE_NAME}</title>
<script>
  var s = new URLSearchParams(location.search).get('stage');
  location.replace(/^[1-5]$/.test(s || '') ? './' + s + '/' : '../');
</script></head><body></body></html>
`);

// ── 2) index.html의 OG 태그를 절대 URL로 ──
const indexPath = join(ROOT, 'index.html');
let index = readFileSync(indexPath, 'utf8');
index = index
  .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${SITE_URL}/assets/og/default.png">`)
  .replace(/\s*<meta property="og:url" content="[^"]*">/, '')
  .replace(/(<meta property="og:type" content="website">)/, `$1\n  <meta property="og:url" content="${SITE_URL}/">`);
writeFileSync(indexPath, index);

// ── 3) OG 이미지 1200×630 (Chrome 헤드리스 스크린샷) ──
const ogCss = `*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;background:#FFF8EE;font-family:Pretendard,'Apple SD Gothic Neo',sans-serif;color:#2B211B;overflow:hidden;word-break:keep-all}`;
const meter = (s, color) => `<div style="display:flex;gap:10px;margin-top:34px">${[1, 2, 3, 4, 5].map((k) => `<i style="display:block;width:76px;height:14px;border-radius:7px;background:${k <= s ? color : '#E9DCCB'}"></i>`).join('')}</div>`;

const pages = {};
for (let s = 1; s <= 5; s++) {
  const st = STAGES[s];
  pages[`stage-${s}`] = `<div style="display:flex;align-items:center;height:630px;padding:0 80px;gap:56px">
    <div style="width:420px;height:420px;border-radius:50%;background:${st.color}22;display:grid;place-items:center;flex:none">${stageSVG(s, { size: 360 })}</div>
    <div>
      <p style="font-size:30px;font-weight:700;color:#5B4B3F">${SERVICE_NAME}</p>
      <p style="margin-top:22px;display:inline-block;background:${st.color};color:#fff;font-size:30px;font-weight:800;padding:6px 22px;border-radius:999px">${s}단계</p>
      <p style="font-size:104px;font-weight:900;letter-spacing:-0.04em;line-height:1.1;margin-top:10px">${st.name}</p>
      <p style="font-size:36px;font-weight:600;color:#5B4B3F;margin-top:8px">${st.tone}</p>
      ${meter(s, st.color)}
    </div></div>`;
}
pages.default = `<div style="height:630px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px">
  <p style="font-size:96px;font-weight:900;letter-spacing:-0.04em">${SERVICE_NAME}</p>
  <p style="font-size:38px;font-weight:600;color:#5B4B3F">사진 2장, 1분이면 끝</p>
  <div style="display:flex;gap:18px;margin-top:30px">${[1, 2, 3, 4, 5].map((s) => stageSVG(s, { size: 170 })).join('')}</div></div>`;

const tmp = join(tmpdir(), `cub-og-${process.pid}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(ROOT, 'assets', 'og'), { recursive: true });
for (const [name, body] of Object.entries(pages)) {
  const file = join(tmp, `${name}.html`);
  writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>${ogCss}</style></head><body>${body}</body></html>`);
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--window-size=1200,630', '--virtual-time-budget=6000',
    `--screenshot=${join(ROOT, 'assets', 'og', `${name}.png`)}`, pathToFileURL(file).href,
  ], { stdio: 'ignore' });
  console.log('og:', name);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`done. SITE_URL=${SITE_URL}`);
