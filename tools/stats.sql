-- 익명 결과 집계용 Supabase 설정 (SQL Editor에서 한 번 실행).
-- 조합별 카운터만 둔다. 개별 기록(행)은 쌓지 않는다.
create table if not exists public.result_counts (
  level    smallint not null check (level between 1 and 5),
  rep_type text     not null check (rep_type in ('L','M','C','U','V','F')),
  gender   text     not null check (gender in ('m','f')),
  age      text     not null check (age in ('10','20','30','40','50')),
  count    bigint   not null default 0,
  primary key (level, rep_type, gender, age)
);

-- anon 키로는 테이블을 직접 읽거나 쓸 수 없다. 아래 함수로 +1 만 가능하다.
alter table public.result_counts enable row level security;
revoke all on public.result_counts from anon, authenticated;

create or replace function public.increment_result(p_level smallint, p_type text, p_gender text, p_age text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.result_counts (level, rep_type, gender, age, count)
  values (p_level, p_type, p_gender, p_age, 1)
  on conflict (level, rep_type, gender, age)
  do update set count = public.result_counts.count + 1;
$$;

revoke all on function public.increment_result(smallint, text, text, text) from public;
grant execute on function public.increment_result(smallint, text, text, text) to anon;

-- ───────── v2: 의심 여부 + 예상 일치 여부 (PRD「의심 여부·고민 체크」) ─────────
-- 이미 위 부분을 실행한 프로젝트에서도 이 블록만 다시 실행하면 된다 (여러 번 실행해도 안전).
-- 기존 행은 suspect='n', match='fine' 으로 채운다 (v2 전 기록은 의심 여부를 묻지 않았음).
alter table public.result_counts add column if not exists suspect text not null default 'n';
alter table public.result_counts add column if not exists match   text not null default 'fine';
alter table public.result_counts drop constraint if exists result_counts_suspect_check;
alter table public.result_counts add constraint result_counts_suspect_check check (suspect in ('y','n'));
alter table public.result_counts drop constraint if exists result_counts_match_check;
alter table public.result_counts add constraint result_counts_match_check
  check (match in ('confirmed','early','relief','elsewhere','fine','surprise'));
alter table public.result_counts drop constraint if exists result_counts_pkey;
alter table public.result_counts add primary key (level, rep_type, gender, age, suspect, match);

-- 옛 함수(increment_result)는 캐시된 옛 JS를 위해 남겨둔다. 새 기본키에 맞게 다시 만든다.
create or replace function public.increment_result(p_level smallint, p_type text, p_gender text, p_age text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.result_counts (level, rep_type, gender, age, suspect, match, count)
  values (p_level, p_type, p_gender, p_age, 'n', 'fine', 1)
  on conflict (level, rep_type, gender, age, suspect, match)
  do update set count = public.result_counts.count + 1;
$$;

create or replace function public.increment_result_v2(
  p_level smallint, p_type text, p_gender text, p_age text, p_suspect text, p_match text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.result_counts (level, rep_type, gender, age, suspect, match, count)
  values (p_level, p_type, p_gender, p_age, p_suspect, p_match, 1)
  on conflict (level, rep_type, gender, age, suspect, match)
  do update set count = public.result_counts.count + 1;
$$;

revoke all on function public.increment_result_v2(smallint, text, text, text, text, text) from public;
grant execute on function public.increment_result_v2(smallint, text, text, text, text, text) to anon;

-- 집계 보기 (대시보드 SQL Editor에서):
-- select level, rep_type, gender, age, suspect, match, count from result_counts order by count desc;
-- 예상 일치율: select match, sum(count) from result_counts where suspect = 'y' group by match;

-- ───────── v3: 결과 화면「N명 중 M명이 같은 단계」 ─────────
-- 레벨별 합계 5개만 돌려준다 (유형·성별·나이대 조합은 내보내지 않는다).
create or replace function public.level_counts()
returns table (level smallint, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select level, sum(count)::bigint from public.result_counts group by level;
$$;

revoke all on function public.level_counts() from public;
grant execute on function public.level_counts() to anon;

-- ───────── v4: 결과 화면「나와 같은 20대 남성의 N%가 같은 레벨」 ─────────
-- 지정한 성별·나이대 안의 레벨별 합계만 돌려준다.
create or replace function public.level_counts_for(p_gender text, p_age text)
returns table (level smallint, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select level, sum(count)::bigint from public.result_counts
  where gender = p_gender and age = p_age
  group by level;
$$;

revoke all on function public.level_counts_for(text, text) from public;
grant execute on function public.level_counts_for(text, text) to anon;
