import { SERVICE_NAME, STAGES } from './content.js';
import { drawStoryCard } from './render.js';
import { track } from './track.js';

const isInApp = () => /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent);
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));

/** 앱 루트 기준 단계별 공유 URL. 각 단계 HTML에 og:image가 따로 박혀 있다. */
export function shareUrl(stage, root = document.baseURI) {
  return new URL(`result/${stage}/`, root).href;
}

export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2200);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

/** 모바일: OS 공유 시트(카카오톡 등). PC·미지원: 링크 복사. */
export async function shareLink(stage, root) {
  const url = shareUrl(stage, root);
  const st = STAGES[stage];
  if (navigator.share && isMobile()) {
    try {
      await navigator.share({ title: SERVICE_NAME, text: `나는 ${stage}단계 「${st.name}」 — ${st.tone}`, url });
      track('share_done', { stage, channel: 'webshare' });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  const ok = await copyText(url);
  track('share_done', { stage, channel: 'copy' });
  toast(ok ? '링크를 복사했어요. 카톡에 붙여넣어 보세요!' : url);
}

/** 1080×1920 결과 카드 저장 (본인 사진·진행 가능성 미포함). */
export async function saveCard(stage, root) {
  const label = new URL(root || document.baseURI).host || '';
  const canvas = await drawStoryCard(stage, label);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], `tal-mo-test-${stage}.png`, { type: 'image/png' });

  if (isMobile() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      track('card_saved', { stage, channel: 'webshare' });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  if (isInApp() || (isMobile() && !('download' in HTMLAnchorElement.prototype))) {
    // 인앱 브라우저는 다운로드가 막혀 있어서 길게 눌러 저장하도록 띄운다
    const sheet = document.getElementById('sheet');
    document.getElementById('sheetImg').src = canvas.toDataURL('image/png');
    sheet.hidden = false;
    track('card_saved', { stage, channel: 'longpress' });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  track('card_saved', { stage, channel: 'download' });
}
