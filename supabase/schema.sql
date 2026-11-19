-- 특별실 이용 현황 공유 및 확인 서비스 - DB 스키마
-- Supabase SQL Editor 가 한 번에 쿼리 하나만 허용하므로, 아래 [1]~[16]를 순서대로 실행한다. 한 번에 쿼리 하나만 허용되는 환경이면 하나씩, 아니면 한 번에 실행해도 된다.
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

-- [10] 자주 쓰는 인원 명단(그룹): 신청할 때 불러와서 명단을 자동 입력한다.
create table if not exists public.member_groups (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  members text not null check (char_length(btrim(members)) > 0),
  created_at timestamptz not null default now(),
  constraint member_groups_user_name_unique unique (user_id, name)
);

-- [11]
alter table public.member_groups enable row level security;

-- [12] 그룹은 본인 것만 조회
create policy "member_groups_select_own" on public.member_groups
  for select to authenticated using (user_id = auth.uid());

-- [13] 그룹은 본인 이름으로만 저장
create policy "member_groups_insert_own" on public.member_groups
  for insert to authenticated with check (user_id = auth.uid());

-- [14] 그룹 삭제는 본인 것만
create policy "member_groups_delete_own" on public.member_groups
  for delete to authenticated using (user_id = auth.uid());

-- [15] 신청이 수정된 시각 (교사 알림함의 "수정됨" 표시에 사용)
alter table public.reservations add column if not exists updated_at timestamptz not null default now();

-- [16] 신청 수정은 본인 신청만, 수정 후 날짜도 오늘(한국 시간) 이후여야 한다.
create policy "reservations_update_own" on public.reservations
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and reserve_date >= (now() at time zone 'Asia/Seoul')::date
  );
