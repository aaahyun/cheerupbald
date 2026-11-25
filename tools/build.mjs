// 정적 공유 페이지 + OG 이미지 빌드.
//   SITE_URL=https://<id>.github.io/cheerupbald node tools/build.mjs
// 크롤러(카카오톡 등)는 JS를 실행하지 않으므로 단계별 HTML에 og:image를 박아 둔다.
import { writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { stageArt, eggLineup, EGG_MASK } from '../js/render.js';
import { STAGES, SERVICE_NAME, DISCLAIMER } from '../js/content.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_URL = pathToFileURL(ROOT).href + '/'; // OG 렌더링(file://)에서 이미지 경로용
const SITE_URL = (process.env.SITE_URL || 'https://YOUR_GITHUB_ID.github.io/cheerupbald').replace(/\/$/, '');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FONT = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css">`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
// 검색엔진 소유 확인 토큰(선택). Search Console·네이버 서치어드바이저에서 받은 content 값.
const GOOGLE_VERIFY = process.env.GOOGLE_VERIFY || '';
const NAVER_VERIFY = process.env.NAVER_VERIFY || '';

// ── 공통 SEO <head> 블록 ──
// base: 페이지에서 사이트 루트까지의 상대경로 (아이콘용)
function seoHead({ title, description, ogTitle = title, ogDescription = description, path, image, imageAlt, index = true, base, jsonLd }) {
  const url = `${SITE_URL}${path}`;
  const lines = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<meta name="robots" content="${index ? 'index,follow,max-image-preview:large' : 'noindex,follow'}">`,
    `<link rel="canonical" href="${url}">`,
    GOOGLE_VERIFY && `<meta name="google-site-verification" content="${esc(GOOGLE_VERIFY)}">`,
    NAVER_VERIFY && `<meta name="naver-site-verification" content="${esc(NAVER_VERIFY)}">`,
    `<meta name="theme-color" content="#EEEEEF">`,
    `<meta name="format-detection" content="telephone=no">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(SERVICE_NAME)}">`,
    `<meta property="og:locale" content="ko_KR">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${esc(ogTitle)}">`,
    `<meta property="og:description" content="${esc(ogDescription)}">`,
    `<meta property="og:image" content="${SITE_URL}${image}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(imageAlt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(ogTitle)}">`,
    `<meta name="twitter:description" content="${esc(ogDescription)}">`,
    `<meta name="twitter:image" content="${SITE_URL}${image}">`,
    `<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="${base}assets/apple-touch-icon.png">`,
    jsonLd && `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ];
  return lines.filter(Boolean).join('\n  ');
}

const HOME = {
  title: `${SERVICE_NAME} · 1분 탈모 테스트`,
  description: '사진 2장으로 1분 만에 해보는 탈모 자가 체크 테스트. M자형·정수리형 등 탈모 유형과 5단계 레벨을 재미로 확인해 보세요. 사진은 서버로 전송되지 않아요.',
  ogTitle: SERVICE_NAME,
  ogDescription: '사진 2장, 1분이면 끝. 재미로 보는 탈모 자가 체크',
  path: '/',
  image: '/assets/og/default.png',
  imageAlt: '당신은 탈모입니까? — 사진 2장, 1분이면 끝. 다섯 단계의 달걀 캐릭터',
  base: '',
};
HOME.jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SERVICE_NAME,
  alternateName: '1분 탈모 테스트',
  url: `${SITE_URL}/`,
  description: HOME.description,
  inLanguage: 'ko-KR',
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Any',
  browserRequirements: 'Requires JavaScript and a camera or photo upload',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
  image: `${SITE_URL}${HOME.image}`,
};

// ── 1) 단계별 공유 페이지 ──
for (let s = 1; s <= 5; s++) {
  const st = STAGES[s];
  const title = `나는 레벨 ${s} 「${st.name}」 · ${SERVICE_NAME}`;
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  ${seoHead({
    title,
    description: `${st.tone} — 사진 2장, 1분이면 끝. 나도 탈모 테스트 해보기`,
    ogDescription: `${st.tone} · 나도 1분 탈모 테스트 해보기`,
    path: `/result/${s}/`,
    image: `/assets/og/stage-${s}.png`,
    imageAlt: `탈모 테스트 결과 레벨 ${s} 「${st.name}」 — ${st.tone}`,
    // 결과 공유 페이지는 미리보기용이라 검색 결과에서는 빼고, 링크는 따라가게 둔다
    index: false,
    base: '../../',
  })}
  ${FONT}
  <link rel="stylesheet" href="../../css/style.css">
</head>
<body data-stage="${s}">
<main id="app">
  <section class="screen shared lit" data-screen="result" style="--lv:${st.color}">
    <article class="result">
    <header class="result-hero">
      <p class="eyebrow rule"><span>친구의 탈모 테스트 결과</span><span>LV.${String(s).padStart(2, '0')} / 05</span></p>
      <div class="big-egg">${stageArt(s, { size: 250, base: '../../' })}</div>
      ${eggLineup(s, { base: '../../' })}
      <div class="reveal-text">
        <p class="level-chip"><i></i>레벨 ${s} / 5</p>
        <h1 class="stage-name">${esc(st.name)}</h1>
        <p class="tone">${esc(st.tone)}</p>
      </div>
    </header>
    <div class="card"><h3>레벨 ${s}</h3><p class="h">${esc(st.name)}</p><p>${esc(st.desc)}</p></div>
    <div class="bottom col">
      <a class="btn primary big" href="../../" data-action="cta">나도 테스트하기 <svg class="i" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></a>
      <button class="btn" data-action="share">친구에게 공유하기</button>
    </div>
    <footer class="disclaimer">${esc(DISCLAIMER)}</footer>
    </article>
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
<meta name="robots" content="noindex,follow">
<script>
  var s = new URLSearchParams(location.search).get('stage');
  location.replace(/^[1-5]$/.test(s || '') ? './' + s + '/' : '../');
</script></head><body></body></html>
`);

// ── 2) index.html의 SEO 블록 + sitemap.xml ──
const indexPath = join(ROOT, 'index.html');
const index = readFileSync(indexPath, 'utf8');
const SEO_BLOCK = /(<!-- seo:[^\n]*-->)[\s\S]*?(<!-- \/seo -->)/;
if (!SEO_BLOCK.test(index)) throw new Error('index.html에 <!-- seo: --> … <!-- /seo --> 블록이 없습니다');
writeFileSync(indexPath, index.replace(SEO_BLOCK, (_, open, close) => `${open}\n  ${seoHead(HOME)}\n  ${close}`));

// 검색에 노출할 페이지는 홈 하나. (프로젝트 페이지라 /cheerupbald/robots.txt는 크롤러가 읽지 않으므로
// sitemap은 Search Console·네이버 서치어드바이저에 직접 제출한다)
const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><lastmod>${today}</lastmod></url>
</urlset>
`);

// ── 3) OG 이미지 1200×630 (Chrome 헤드리스 스크린샷) ──
const ogCss = `*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;background:linear-gradient(180deg,#EEEEEF 0%,#DCDCDE 55%,#CDCDD0 100%);font-family:Pretendard,'Apple SD Gothic Neo',sans-serif;color:#141414;overflow:hidden;word-break:keep-all}
.egg{-webkit-mask-image:${EGG_MASK};mask-image:${EGG_MASK};display:block}
.rule{display:flex;justify-content:space-between;border-top:3px solid #141414;padding-top:14px;font-size:20px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#48484B}`;
const img = (s, size) => stageArt(s, { size, base: ROOT_URL, cls: 'egg' });
const row = (me, size) => `<div style="display:flex;gap:4px;align-items:flex-end">${[1, 2, 3, 4, 5].map((k) => `<div style="position:relative;${me && k !== me ? 'filter:grayscale(1);opacity:.45' : ''}">${img(k, size)}${k === me ? `<i style="position:absolute;left:30%;right:30%;bottom:-4px;height:6px;border-radius:3px;background:${STAGES[me].color}"></i>` : ''}</div>`).join('')}</div>`;

const pages = {};
for (let s = 1; s <= 5; s++) {
  const st = STAGES[s];
  pages[`stage-${s}`] = `<div style="position:absolute;inset:0;background:radial-gradient(40% 70% at 26% 50%,${st.color}40,transparent 75%)"></div>
  <div style="position:relative;display:flex;align-items:center;height:630px;padding:0 72px 0 40px;gap:24px">
    <div style="flex:none">${img(s, 470)}</div>
    <div style="flex:1">
      <p class="rule"><span>Specimen Report</span><span>LV.0${s} / 05</span></p>
      <p style="font-size:30px;font-weight:700;color:#48484B;margin-top:26px">${SERVICE_NAME}</p>
      <p style="font-size:118px;font-weight:900;letter-spacing:-0.06em;line-height:1.05;margin-top:6px">${st.name}</p>
      <p style="font-size:34px;font-weight:600;color:#48484B;margin-top:10px">${st.tone}</p>
      <div style="margin-top:22px">${row(s, 96)}</div>
    </div></div>`;
}
pages.default = `<div style="height:630px;display:flex;flex-direction:column;padding:56px 80px">
  <p class="rule"><span>Hair Self-Check</span><span>1 min</span></p>
  <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:30px">
    <p style="font-size:112px;font-weight:900;letter-spacing:-0.06em;line-height:1">당신은<br>탈모입니까?</p>
    <p style="font-size:34px;font-weight:700;color:#48484B;margin-bottom:10px">사진 2장, 1분이면 끝</p>
  </div>
  <div style="margin-top:auto">${row(0, 200)}</div></div>`;

const tmp = join(tmpdir(), `cub-og-${process.pid}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(ROOT, 'assets', 'og'), { recursive: true });
// 홈 화면 아이콘 (iOS는 SVG 아이콘을 쓰지 않는다)
execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--window-size=180,180', '--default-background-color=00000000',
  `--screenshot=${join(ROOT, 'assets', 'apple-touch-icon.png')}`,
  'data:text/html,' + encodeURIComponent(`<body style="margin:0">${readFileSync(join(ROOT, 'assets', 'favicon.svg'), 'utf8').replace('<svg ', '<svg width="180" height="180" ').replace('rx="16"', 'rx="0"')}</body>`),
], { stdio: 'ignore' });
console.log('icon: apple-touch-icon');

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
