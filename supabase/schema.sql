-- 특별실 이용 현황 공유 및 확인 서비스 - DB 스키마
-- Supabase 대시보드 > SQL Editor 에서 전체를 붙여 넣고 Run 하면 된다. (여러 번 실행해도 안전)

-- 1. 회원 정보: 기본키는 학번이 아니라 인증 서비스가 만드는 auth id.
--    학번은 학년이 바뀌면 달라지므로 수정 가능한 일반 필드로 둔다.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  student_id text not null unique
    check (student_id ~ '^[1-3][1-6](0[1-9]|[1-9][0-9])$'),
  name text not null check (char_length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);

-- 2. 특별실 목록
create table if not exists public.rooms (
  id smallint generated always as identity primary key,
  name text not null unique,
  sort_order smallint not null default 0
);

insert into public.rooms (name, sort_order) values
  ('그룹스터디룸 1', 1),
  ('그룹스터디룸 2', 2),
  ('세미나실', 3),
  ('화학실험실', 4),
  ('물리실험실', 5)
on conflict (name) do nothing;

-- 3. 신청 정보: (특별실, 날짜, 교시) 조합이 겹치면 DB가 두 번째 신청을 거부한다.
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

create index if not exists reservations_user_idx on public.reservations (user_id);

-- 4. 회원가입 시 프로필 자동 생성 (가입 때 넘긴 학번/이름을 사용)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, student_id, name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'student_id',
    new.raw_user_meta_data ->> 'name'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. 접근 권한(RLS)
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.reservations enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "rooms_select_all" on public.rooms;
create policy "rooms_select_all" on public.rooms
  for select to anon, authenticated using (true);

-- 현황 표는 모든 이용자에게 공개
drop policy if exists "reservations_select_all" on public.reservations;
create policy "reservations_select_all" on public.reservations
  for select to anon, authenticated using (true);

-- 신청은 로그인한 본인 이름으로, 오늘(한국 시간) 이후 날짜만 가능
drop policy if exists "reservations_insert_own" on public.reservations;
create policy "reservations_insert_own" on public.reservations
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and reserve_date >= (now() at time zone 'Asia/Seoul')::date
  );

-- 취소는 본인 신청만
drop policy if exists "reservations_delete_own" on public.reservations;
create policy "reservations_delete_own" on public.reservations
  for delete to authenticated using (user_id = auth.uid());
