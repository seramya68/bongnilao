-- Bông Inbox v2: keep existing messages and policies. PostgreSQL / Database mode.
begin;
alter table public.messages enable row level security;
-- Non-admin users may only mark Bông's own incoming messages as read.
drop policy if exists bong_inbox_user_mark_read on public.messages;
create policy bong_inbox_user_mark_read on public.messages
  for update to authenticated
  using (user_id=(select auth.uid()) and sender_role='admin')
  with check (user_id=(select auth.uid()) and sender_role='admin' and read_by_user=true);
-- Existing admin policy is unchanged. Protect every other column for non-admins.
create or replace function public.bong_inbox_guard_message_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user = 'authenticated' and not public.is_admin() then
    if old.user_id is distinct from auth.uid()
       or old.sender_role <> 'admin'
       or new.read_by_user is distinct from true
       or (to_jsonb(new) - 'read_by_user') is distinct from (to_jsonb(old) - 'read_by_user') then
      raise exception 'Only marking your own incoming messages as read is allowed' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists bong_inbox_guard_message_update on public.messages;
create trigger bong_inbox_guard_message_update before update on public.messages
  for each row execute function public.bong_inbox_guard_message_update();
-- Stop an ordinary user from creating a message already marked as read by Bông.
create or replace function public.bong_inbox_guard_message_insert()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user = 'authenticated' and not public.is_admin() then
    if new.user_id is distinct from auth.uid() or new.sender_role <> 'user' then
      raise exception 'Invalid sender' using errcode='42501';
    end if;
    new.read_by_admin:=false;
    new.read_by_user:=true;
  end if;
  return new;
end;
$$;
drop trigger if exists bong_inbox_guard_message_insert on public.messages;
create trigger bong_inbox_guard_message_insert before insert on public.messages
  for each row execute function public.bong_inbox_guard_message_insert();
create index if not exists bong_inbox_user_time_idx on public.messages(user_id,created_at,id);
create index if not exists bong_inbox_unread_admin_idx on public.messages(read_by_admin) where sender_role='user';
create index if not exists bong_inbox_unread_user_idx on public.messages(user_id,read_by_user) where sender_role='admin';
commit;
select sender_role,count(*) as so_tin_nhan from public.messages group by sender_role order by sender_role;
