import { loadModels, fileToCanvas, analyzeFront, analyzeCrown, QualityError, CROWN_CIRCLE } from './vision.js';
import { judgeMale, judgeFemale, progression, NORWOOD_LABEL, LUDWIG_LABEL } from './judge.js';
import { STAGES, FEMALE_DESC, PROGRESSION, FAIL_MESSAGES, ANALYZING_STEPS, DISCLAIMER, PRIVACY_NOTE } from './content.js';
import { stageSVG, drawFrontOverlay, drawCrownOverlay } from './render.js';
import { GUIDES } from './guides.js';
import { shareLink, saveCard } from './share.js';
import { track } from './track.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────────────────────── 상태 ─────────────────────────
// 사진·측정값은 이 메모리 객체에만 있고, 탭을 닫으면 사라진다.
const state = {
  info: { gender: null, age: null, family: null },
  front: null, frontCanvas: null,
  crown: null, crownCanvas: null,
  result: null,
  pendingError: null,
  busy: false,
  variant: pickVariant(),
};
// ?debug=1 : 결과 화면에 측정값 표시 (기준값 보정용, 팀 내부 테스트 전용)
const DEBUG = new URLSearchParams(location.search).has('debug');
if (DEBUG) window.__cub = state;

function pickVariant() {
  const q = new URLSearchParams(location.search).get('variant');
  if (q && /^[ab]$/i.test(q)) return q.toUpperCase();
  try {
    let v = localStorage.getItem('cub_variant');
    if (v !== 'A' && v !== 'B') { v = Math.random() < 0.5 ? 'A' : 'B'; localStorage.setItem('cub_variant', v); }
    return v;
  } catch {
    return Math.random() < 0.5 ? 'A' : 'B';
  }
}

// ───────────────────────── 화면 전환 ─────────────────────────
let current = { screen: null, step: null };

function show(screen, step = null) {
  current = { screen, step };
  $$('.screen').forEach((s) => { s.hidden = s.dataset.screen !== screen; });
  if (screen === 'capture') renderCapture(step);
  if (screen === 'result') renderResult();
  window.scrollTo(0, 0);
}

function go(screen, step = null, { replace = false } = {}) {
  const st = { screen, step };
  if (replace) history.replaceState(st, ''); else history.pushState(st, '');
  show(screen, step);
}

window.addEventListener('popstate', (e) => {
  let { screen, step } = e.state || { screen: 'landing' };
  if (screen === 'analyzing') { screen = 'capture'; step = 'crown'; }
  if (screen === 'result' && !state.result) screen = 'landing';
  if (screen === 'capture' && step === 'crown' && !state.front) step = 'front';
  if ((screen === 'capture' || screen === 'info') && !infoComplete() && screen !== 'info') screen = 'info';
  show(screen, step);
});

// ───────────────────────── 랜딩 ─────────────────────────
function initLanding() {
  const art = $('#landingArt');
  let s = 1;
  const tick = () => { art.innerHTML = stageSVG(s); s = (s % 5) + 1; };
  tick();
  setInterval(() => { if (current.screen === 'landing') tick(); }, 1100);
  $$('[data-disclaimer]').forEach((el) => { el.textContent = DISCLAIMER; });
  $$('[data-privacy]').forEach((el) => { el.textContent = PRIVACY_NOTE; });
}

// ───────────────────────── 기본 정보 ─────────────────────────
const infoComplete = () => Object.values(state.info).every(Boolean);

function initInfo() {
  $$('.choices').forEach((group) => {
    const field = group.dataset.field;
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      state.info[field] = btn.dataset.value;
      $$('button', group).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      $('[data-action="info-next"]').disabled = !infoComplete();
    });
    $$('button', group).forEach((b) => b.setAttribute('aria-pressed', 'false'));
  });
}

// ───────────────────────── 촬영 ─────────────────────────
function setStatus(kind, html) {
  const el = $('#capStatus');
  if (!kind) { el.hidden = true; return; }
  el.className = `cap-status ${kind}`;
  el.innerHTML = html;
  el.hidden = false;
}

function previewCanvas(canvas, step) {
  const size = 720;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  if (step === 'crown') {
    // 분석에 쓰는 원과 같은 영역을 보여준다
    const r = Math.min(canvas.width, canvas.height) * CROWN_CIRCLE.radiusRatio;
    const sx = canvas.width / 2 - r, sy = canvas.height / 2 - r;
    ctx.drawImage(canvas, sx, sy, 2 * r, 2 * r, 0, 0, size, size);
    ctx.strokeStyle = '#FF6B3D'; ctx.lineWidth = 6; ctx.setLineDash([24, 16]);
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2); ctx.stroke();
  } else {
    const k = Math.min(size / canvas.width, size / canvas.height);
    const w = canvas.width * k, h = canvas.height * k;
    ctx.drawImage(canvas, (size - w) / 2, (size - h) / 2, w, h);
  }
  return c;
}

function renderCapture(step) {
  const g = GUIDES[step];
  $('#capStep').textContent = g.step;
  $('#capTitle').textContent = g.title;
  $('#capTips').innerHTML = g.tips.map((t) => `<li>${t}</li>`).join('');
  $('#capShoot').setAttribute('capture', g.capture);
  const done = state[step];
  const guide = $('#capGuide');
  if (done) {
    guide.replaceChildren(previewCanvas(state[`${step}Canvas`], step));
    setStatus('ok', '✓ 좋아요! 잘 찍혔어요');
  } else {
    guide.innerHTML = g.svg;
    setStatus(null);
  }
  if (state.pendingError) {
    setStatus('err', FAIL_MESSAGES[state.pendingError]);
    state.pendingError = null;
  }
  $('#capNext').hidden = !done;
  $('#capNext').textContent = step === 'front' ? '다음' : '결과 보기';
  $('#capShootLabel').lastChild.textContent = done ? '다시 찍기' : '촬영하기';
}

async function handleFile(file) {
  const step = current.step;
  if (!file || state.busy || current.screen !== 'capture') return;
  state.busy = true;
  state[step] = null;
  $('#capNext').hidden = true;
  track('photo_upload', { step });

  const modelsReady = await Promise.race([loadModels().then(() => true, () => false), sleep(50).then(() => null)]);
  setStatus('busy', `<span class="spinner"></span>${modelsReady === null ? '분석 도구 준비 중… (처음 한 번만)' : '사진 확인 중…'}`);

  try {
    const canvas = await fileToCanvas(file);
    $('#capGuide').replaceChildren(previewCanvas(canvas, step));
    setStatus('busy', '<span class="spinner"></span>사진 확인 중…');
    const result = step === 'front' ? await analyzeFront(canvas) : await analyzeCrown(canvas);
    if (step === 'front' && result.hairlineMissing && state.info.gender === 'f') throw new QualityError('hairline');
    if (current.step !== step) return; // 처리 중 화면이 바뀜
    state[step] = result;
    state[`${step}Canvas`] = canvas;
    setStatus('ok', '✓ 좋아요! 잘 찍혔어요');
    $('#capNext').hidden = false;
    $('#capShootLabel').lastChild.textContent = '다시 찍기';
    track('photo_pass', { step });
  } catch (err) {
    const reason = err instanceof QualityError ? err.reason : 'model';
    const msg = FAIL_MESSAGES[reason] || '분석 도구를 불러오지 못했어요. 네트워크를 확인하고 다시 시도해주세요';
    if (reason === 'model') console.error(err);
    setStatus('err', msg);
    $('#capShootLabel').lastChild.textContent = '다시 찍기';
    track('photo_fail', { step, reason });
  } finally {
    state.busy = false;
  }
}

function initCapture() {
  for (const id of ['capShoot', 'capAlbum']) {
    const input = $(`#${id}`);
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      input.value = ''; // 같은 파일을 다시 골라도 change가 나도록
      handleFile(f);
    });
  }
  $('#capNext').addEventListener('click', () => {
    if (current.step === 'front') go('capture', 'crown');
    else runAnalysis();
  });
}

// ───────────────────────── 검사 중 ─────────────────────────
async function runAnalysis() {
  go('analyzing', null, { replace: true });
  $('#scanArt').innerHTML = stageSVG(2);
  const dots = $$('.dots i');
  const text = $('#analyzeText');

  const { info, front, crown } = state;
  let judged, service, scaleRef;
  if (info.gender === 'f') {
    judged = judgeFemale(crown);
    service = judged.service;
    scaleRef = judged.ludwig === 0 ? '루드비히 기준 정상 범위' : `루드비히 ${LUDWIG_LABEL[judged.ludwig]}형 참고`;
  } else {
    judged = judgeMale(front, crown);
    service = judged.service;
    scaleRef = judged.norwood ? `노우드-해밀턴 ${NORWOOD_LABEL[judged.norwood]}형 참고` : '';
  }

  // 최소 3초 노출: 문구 4개 × 800ms
  for (let i = 0; i < ANALYZING_STEPS.length; i++) {
    text.textContent = ANALYZING_STEPS[i];
    dots.forEach((d, k) => d.classList.toggle('on', k <= i));
    if (i === 2) $('#scanArt').innerHTML = stageSVG(3);
    await sleep(800);
  }

  if (judged.retake) {
    state.front = null;
    state.frontCanvas = null;
    state.pendingError = 'hairline';
    track('photo_fail', { step: 'front', reason: 'hairline_after_crown' });
    go('capture', 'front', { replace: true });
    return;
  }
  state.result = { service, scaleRef, prog: progression(info, service), female: info.gender === 'f' };
  go('result', null, { replace: true });
}

// ───────────────────────── 결과 ─────────────────────────
const STAGE_NAMES = [1, 2, 3, 4, 5].map((s) => STAGES[s].name);

function renderResult() {
  const { service: s, scaleRef, prog, female } = state.result;
  const st = STAGES[s];
  const desc = female ? FEMALE_DESC[s] : st.desc;
  const progCard = (() => {
    if (!prog.level) return '';
    const p = PROGRESSION[prog.level];
    const why = prog.reasons.length ? `<p class="prog-why">${prog.reasons.join(' · ')}</p>` : '';
    return `<div class="card"><h3>진행 가능성</h3><p class="prog-level">${p.label}</p><p>${p.text}</p>${why}</div>`;
  })();

  $('#resultBody').innerHTML = `
    <div class="result-head">
      <span class="badge" style="background:${st.color}">${s}단계</span>
      <h1 class="stage-name">${st.name}</h1>
      <p class="tone">${st.tone}</p>
      ${scaleRef ? `<p class="scale-ref">${scaleRef}</p>` : ''}
    </div>
    <div class="meter">${[1, 2, 3, 4, 5].map((k) => `<i style="${k <= s ? `background:${st.color}` : ''}"></i>`).join('')}</div>
    <div class="meter-labels">${STAGE_NAMES.map((n, i) => `<span class="${i + 1 === s ? 'me' : ''}">${n}</span>`).join('')}</div>
    <div class="photos">
      <figure><div id="ovFront"></div><figcaption>${female ? '내 헤어라인' : state.variant === 'B' ? '단계별 헤어라인' : '내 단계 헤어라인'}</figcaption></figure>
      <figure><div id="ovCrown"></div><figcaption>정수리 노출 영역</figcaption></figure>
    </div>
    <p class="photo-note">사진은 이 화면에만 보이고 저장되지 않아요</p>
    <div class="card"><h3>내 상태</h3><p>${desc}</p></div>
    ${st.consult ? `<div class="card consult"><h3>상담 안내</h3><p>${st.consult}</p></div>` : ''}
    ${progCard}
    <div class="actions">
      <button class="btn primary" data-action="share">공유하기</button>
      <button class="btn" data-action="save">이미지 저장</button>
      <button class="btn ghost full" data-action="retry">다시 하기</button>
    </div>
    <footer class="disclaimer">${DISCLAIMER}</footer>
    ${DEBUG ? `<pre class="debug">${debugText()}</pre>` : ''}
  `;
  const fc = drawFrontOverlay(state.frontCanvas, state.front, s, state.variant, female);
  $('#ovFront').replaceWith(cropFace(fc, state.front.geom));
  $('#ovCrown').replaceWith(drawCrownOverlay(state.crownCanvas, state.crown, s));
  track('result_view', { stage: s, variant: state.variant });
}

function debugText() {
  const f = state.front, c = state.crown, r = (v, d = 2) => (v == null ? '–' : v.toFixed(d));
  return [
    `variant ${state.variant} · ${state.result.scaleRef}`,
    `F ${r(f.F)}  M ${r(f.M)}  hairlineMissing ${f.hairlineMissing}`,
    `C ${r(c.C, 1)}%  B ${c.B}  part ${r(c.part, 1)}%`,
    `progression ${JSON.stringify(state.result.prog)}`,
  ].join('\n');
}

// 정면 오버레이를 얼굴 중심 정사각형으로 자른다
function cropFace(canvas, geom) {
  const { browC, U } = geom;
  const half = U * 2.7;
  const cx = browC.x, cy = browC.y - U * 0.8;
  const c = document.createElement('canvas');
  const size = 720;
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#eee';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(canvas, cx - half, cy - half, half * 2, half * 2, 0, 0, size, size);
  return c;
}

// ───────────────────────── 액션 ─────────────────────────
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a === 'start') {
    track('start_click');
    go('info');
    loadModels().catch(() => {}); // 정보 입력 중 미리 로드
  } else if (a === 'back') {
    history.back();
  } else if (a === 'info-next') {
    if (!infoComplete()) return;
    track('info_complete');
    go('capture', 'front');
  } else if (a === 'share') {
    track('share_click', { stage: state.result.service, variant: state.variant });
    shareLink(state.result.service);
  } else if (a === 'save') {
    track('save_click', { stage: state.result.service });
    saveCard(state.result.service);
  } else if (a === 'retry') {
    track('retry_click', { stage: state.result.service });
    Object.assign(state, { front: null, frontCanvas: null, crown: null, crownCanvas: null, result: null });
    go('capture', 'front');
  } else if (a === 'close-sheet') {
    $('#sheet').hidden = true;
  }
});

// ───────────────────────── 시작 ─────────────────────────
initLanding();
initInfo();
initCapture();
history.replaceState({ screen: 'landing' }, '');
show('landing');
track('landing_view', { variant: state.variant });
