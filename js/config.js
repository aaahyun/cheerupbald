// 익명 결과 집계(PRD v1.1「익명 결과 집계」) 설정.
// Supabase 프로젝트를 만들고 tools/stats.sql 을 실행한 뒤 아래 두 값을 채운다.
// anon 키는 공개돼도 되는 키다 — stats.sql 이 이 키로는 카운터 증가 함수만 부를 수 있게 막는다.
// 비워 두면 집계 요청을 보내지 않는다.
export const STATS = {
  url: 'https://fcwqazuwixixgfzqyeuc.supabase.co', // 끝에 /rest/v1 은 붙이지 않는다 (stats.js 가 붙임)
  anonKey: 'sb_publishable_nk8wN6cS3E5HO7XkLxaLnQ_riLuFT2_', // API Keys → Publishable key
};
