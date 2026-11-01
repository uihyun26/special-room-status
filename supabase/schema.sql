-- 특별실 이용 현황 공유 및 확인 서비스 - DB 스키마
-- Supabase SQL Editor 가 한 번에 쿼리 하나만 허용하므로, 아래 [1]~[9]를 순서대로 하나씩 실행한다.
--
-- 회원 정보: 별도 테이블 없이 Supabase Auth(auth.users)가 관리한다.
--   - 계정의 기본키(식별자)는 auth id 이고, 학번/이름은 사용자 정보(user_metadata)로 저장한다.
--   - 학번은 학년이 바뀌면 달라지므로 수정 가능한 일반 필드로 취급한다.

-- [1] 특별실 목록
create table if not exists public.rooms (
  id smallint generated always as identity primary key,
  name text not null unique,
  sort_order smallint not null default 0
);

-- [2] 특별실 기본 데이터
insert into public.rooms (name, sort_order) values
  ('그룹스터디룸 1', 1),
  ('그룹스터디룸 2', 2),
  ('세미나실', 3),
  ('화학실험실', 4),
  ('물리실험실', 5)
on conflict (name) do nothing;

-- [3] 신청 정보: (특별실, 날짜, 교시) 조합이 겹치면 DB가 두 번째 신청을 거부한다.
create table if not exists public.reservations (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  room_id smallint not null references public.rooms (id),
  reserve_date date not null,
  period smallint not null check (period between 1 and 7),
  purpose text not null check (char_length(btrim(purpose)) > 0),
  members text not null check (char_length(btrim(members)) > 0),
  teacher text,
  created_at timestamptz not null default now(),
  constraint reservations_unique_slot unique (room_id, reserve_date, period)
);

-- [4] 접근 제어(RLS) 켜기
alter table public.rooms enable row level security;

-- [5]
alter table public.reservations enable row level security;

-- [6] 특별실 목록은 누구나 조회
create policy "rooms_select_all" on public.rooms
  for select to anon, authenticated using (true);

-- [7] 현황 표는 모든 이용자에게 공개
create policy "reservations_select_all" on public.reservations
  for select to anon, authenticated using (true);

-- [8] 신청은 로그인한 본인 이름으로, 오늘(한국 시간) 이후 날짜만 가능
create policy "reservations_insert_own" on public.reservations
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and reserve_date >= (now() at time zone 'Asia/Seoul')::date
  );

-- [9] 취소는 본인 신청만
create policy "reservations_delete_own" on public.reservations
  for delete to authenticated using (user_id = auth.uid());
