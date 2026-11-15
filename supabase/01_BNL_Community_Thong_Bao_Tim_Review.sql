-- NHÀ CỦA BÔNG | COMMUNITY v1.1
-- ĐÚNG PROJECT SUPABASE: BNL (qkkftribgkakexkfuxip)
-- Chạy trong Dashboard > SQL Editor, chỉ sau khi kiểm tra đang ở project BNL.
-- Không DROP dữ liệu cũ. File có thể chạy lại mà không tạo dữ liệu trùng.
-- Phụ thuộc cấu trúc hiện có: public.profiles(id,role), public.character_reviews(id,admin_reply,admin_reply_at), public.is_admin().

begin;

-- 1. Tin thông báo của Bông, đọc công khai nhưng chỉ admin được thêm/sửa/xóa.
create table if not exists public.bong_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 140),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  link_url text,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bong_announcements_created_idx on public.bong_announcements(created_at desc);
alter table public.bong_announcements enable row level security;
grant select on public.bong_announcements to anon, authenticated;
grant insert, update, delete on public.bong_announcements to authenticated;

drop policy if exists bong_announcements_public_read on public.bong_announcements;
create policy bong_announcements_public_read on public.bong_announcements
  for select to anon, authenticated using (true);
drop policy if exists bong_announcements_admin_insert on public.bong_announcements;
create policy bong_announcements_admin_insert on public.bong_announcements
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists bong_announcements_admin_update on public.bong_announcements;
create policy bong_announcements_admin_update on public.bong_announcements
  for update to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));
drop policy if exists bong_announcements_admin_delete on public.bong_announcements;
create policy bong_announcements_admin_delete on public.bong_announcements
  for delete to authenticated using ((select public.is_admin()));

-- 2. Lịch sử đã xem (cùng một tài khoản có thể đồng bộ nhiều thiết bị).
create table if not exists public.bong_announcement_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  announcement_id uuid not null references public.bong_announcements(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);
create index if not exists bong_announcement_reads_ann_idx on public.bong_announcement_reads(announcement_id);
alter table public.bong_announcement_reads enable row level security;
grant select, insert, delete on public.bong_announcement_reads to authenticated;
drop policy if exists bong_reads_select_own on public.bong_announcement_reads;
create policy bong_reads_select_own on public.bong_announcement_reads
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists bong_reads_insert_own on public.bong_announcement_reads;
create policy bong_reads_insert_own on public.bong_announcement_reads
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists bong_reads_delete_own on public.bong_announcement_reads;
create policy bong_reads_delete_own on public.bong_announcement_reads
  for delete to authenticated using (user_id = (select auth.uid()));

-- 3. Mỗi tài khoản thả tim review tối đa một lần, bấm lại để bỏ tim.
-- Không tạo tính năng trả lời review giữa người chơi.
create table if not exists public.bong_review_likes (
  review_id uuid not null references public.character_reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);
create index if not exists bong_review_likes_user_idx on public.bong_review_likes(user_id);
alter table public.bong_review_likes enable row level security;
grant select on public.bong_review_likes to anon, authenticated;
grant insert, delete on public.bong_review_likes to authenticated;
drop policy if exists bong_likes_public_read on public.bong_review_likes;
create policy bong_likes_public_read on public.bong_review_likes
  for select to anon, authenticated using (true);
drop policy if exists bong_likes_insert_own on public.bong_review_likes;
create policy bong_likes_insert_own on public.bong_review_likes
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists bong_likes_delete_own on public.bong_review_likes;
create policy bong_likes_delete_own on public.bong_review_likes
  for delete to authenticated using (user_id = (select auth.uid()));

-- 4. Chỉ Bông Admin được ghi hoặc xóa admin_reply của review.
-- Trigger bảo vệ ngay ở DB, kể cả khi người chơi cố gọi API trực tiếp.
create or replace function public.bong_guard_review_admin_reply()
returns trigger language plpgsql set search_path = '' as $$
declare
  changed boolean := false;
begin
  if tg_op = 'INSERT' then
    changed := coalesce(trim(new.admin_reply),'') <> '' or new.admin_reply_at is not null;
  elsif tg_op = 'UPDATE' then
    changed := (new.admin_reply is distinct from old.admin_reply)
      or (new.admin_reply_at is distinct from old.admin_reply_at);
  end if;

  if changed
     and current_user <> 'postgres'
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and not (select public.is_admin()) then
    raise exception 'Only Bong Admin may change review replies';
  end if;
  return new;
end;
$$;
revoke all on function public.bong_guard_review_admin_reply() from public, anon, authenticated;
drop trigger if exists bong_guard_review_admin_reply_trigger on public.character_reviews;
create trigger bong_guard_review_admin_reply_trigger
  before insert or update on public.character_reviews
  for each row execute function public.bong_guard_review_admin_reply();

commit;

-- XÁC NHẬN SQL ĐÃ CHẠY THÀNH CÔNG (3 hàng):
select 'Thông báo' as chuc_nang, count(*) as so_dong from public.bong_announcements
union all select 'Đã xem',count(*) from public.bong_announcement_reads
union all select 'Tim review',count(*) from public.bong_review_likes;
