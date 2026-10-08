-- ============================================================
-- NHÀ CỦA BÔNG — SUPABASE SCHEMA V1
-- Run this ONCE in Supabase SQL Editor.
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique not null,
  display_name text not null,
  role text not null default 'user'
    check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Create profile automatically from Supabase Auth metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_display_name text;
begin
  v_username :=
    lower(
      coalesce(
        nullif(new.raw_user_meta_data ->> 'username', ''),
        split_part(coalesce(new.email, ''), '@', 1),
        'user_' || left(new.id::text, 8)
      )
    );

  v_display_name :=
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      v_username
    );

  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, v_display_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Admin helper.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

-- Users intentionally do NOT receive an UPDATE policy on profiles.
-- This prevents changing their own role to admin.
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ------------------------------------------------------------
-- CHARACTERS
-- ------------------------------------------------------------
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null
    check (category in ('Chồng Tây', 'Chồng Việt Nam')),
  age text not null default '',
  job text not null default '',
  location text not null default '',
  quote text not null default '',
  tags text[] not null default '{}',
  image_folder text not null default '',
  music_file text not null default '',
  ggai_url text not null default '',
  is_published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.characters enable row level security;

drop policy if exists "characters_public_read" on public.characters;
create policy "characters_public_read"
on public.characters
for select
to anon, authenticated
using (is_published = true or public.is_admin());

drop policy if exists "characters_admin_insert" on public.characters;
create policy "characters_admin_insert"
on public.characters
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "characters_admin_update" on public.characters;
create policy "characters_admin_update"
on public.characters
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "characters_admin_delete" on public.characters;
create policy "characters_admin_delete"
on public.characters
for delete
to authenticated
using (public.is_admin());

-- ------------------------------------------------------------
-- PUBLIC STORY CONTENT
-- Background + Opening may be read for published characters.
-- ------------------------------------------------------------
create table if not exists public.character_stories (
  character_id uuid primary key references public.characters(id) on delete cascade,
  background_story text not null default '',
  opening_scene text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.character_stories enable row level security;

drop policy if exists "stories_public_read" on public.character_stories;
create policy "stories_public_read"
on public.character_stories
for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.characters c
    where c.id = character_stories.character_id
      and c.is_published = true
  )
);

drop policy if exists "stories_admin_insert" on public.character_stories;
create policy "stories_admin_insert"
on public.character_stories
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "stories_admin_update" on public.character_stories;
create policy "stories_admin_update"
on public.character_stories
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "stories_admin_delete" on public.character_stories;
create policy "stories_admin_delete"
on public.character_stories
for delete
to authenticated
using (public.is_admin());

-- ------------------------------------------------------------
-- PRIVATE PRO5
-- IMPORTANT: no public read policy.
-- Only admin can read/write PRO5.
-- ------------------------------------------------------------
create table if not exists public.character_pro5 (
  character_id uuid primary key references public.characters(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.character_pro5 enable row level security;

drop policy if exists "pro5_admin_select" on public.character_pro5;
create policy "pro5_admin_select"
on public.character_pro5
for select
to authenticated
using (public.is_admin());

drop policy if exists "pro5_admin_insert" on public.character_pro5;
create policy "pro5_admin_insert"
on public.character_pro5
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "pro5_admin_update" on public.character_pro5;
create policy "pro5_admin_update"
on public.character_pro5
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "pro5_admin_delete" on public.character_pro5;
create policy "pro5_admin_delete"
on public.character_pro5
for delete
to authenticated
using (public.is_admin());

-- ------------------------------------------------------------
-- MESSAGES
-- One row = one message in the conversation between a user and Bông.
-- user_id always identifies the normal user whose thread this belongs to.
-- ------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null
    check (sender_role in ('user', 'admin')),
  body text not null
    check (char_length(body) between 1 and 5000),
  read_by_admin boolean not null default false,
  read_by_user boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

-- User can see only their own thread.
drop policy if exists "messages_user_read_own" on public.messages;
create policy "messages_user_read_own"
on public.messages
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Normal user can send only as themselves.
drop policy if exists "messages_user_insert" on public.messages;
create policy "messages_user_insert"
on public.messages
for insert
to authenticated
with check (
  (
    user_id = auth.uid()
    and sender_role = 'user'
  )
  or
  (
    public.is_admin()
    and sender_role = 'admin'
  )
);

drop policy if exists "messages_admin_update" on public.messages;
create policy "messages_admin_update"
on public.messages
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "messages_admin_delete" on public.messages;
create policy "messages_admin_delete"
on public.messages
for delete
to authenticated
using (public.is_admin());

-- ------------------------------------------------------------
-- Helpful indexes
-- ------------------------------------------------------------
create index if not exists idx_characters_category
  on public.characters(category);

create index if not exists idx_characters_published
  on public.characters(is_published);

create index if not exists idx_messages_user_created
  on public.messages(user_id, created_at);

create index if not exists idx_messages_admin_unread
  on public.messages(read_by_admin, created_at);

-- ------------------------------------------------------------
-- updated_at trigger
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_characters_updated_at on public.characters;
create trigger trg_characters_updated_at
before update on public.characters
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_stories_updated_at on public.character_stories;
create trigger trg_stories_updated_at
before update on public.character_stories
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_pro5_updated_at on public.character_pro5;
create trigger trg_pro5_updated_at
before update on public.character_pro5
for each row execute procedure public.set_updated_at();


-- ------------------------------------------------------------
-- COMMUNITY REVIEWS
-- Publicly readable. Authenticated users can create/update/delete
-- only their own review. One review per user per character.
-- ------------------------------------------------------------
create table if not exists public.character_reviews (
  id uuid primary key default gen_random_uuid(),
  character_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  reviewer_name text not null default 'Người dùng',
  played boolean not null default true,
  love_rating smallint not null check (love_rating between 1 and 5),
  realism_rating smallint not null check (realism_rating between 1 and 5),
  chemistry_rating smallint not null check (chemistry_rating between 1 and 5),
  story_rating smallint not null check (story_rating between 1 and 5),
  overall numeric(3,2) generated always as (
    (love_rating + realism_rating + chemistry_rating + story_rating)::numeric / 4
  ) stored,
  comment text not null default '' check (char_length(comment) <= 1500),
  tips text not null default '' check (char_length(tips) <= 800),
  improvement text not null default '' check (char_length(improvement) <= 800),
  admin_reply text not null default '' check (char_length(admin_reply) <= 1200),
  admin_reply_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, character_key)
);

alter table public.character_reviews enable row level security;

drop policy if exists "reviews_public_read" on public.character_reviews;
create policy "reviews_public_read"
on public.character_reviews
for select
to anon, authenticated
using (true);

drop policy if exists "reviews_user_insert" on public.character_reviews;
create policy "reviews_user_insert"
on public.character_reviews
for insert
to authenticated
with check (
  user_id = auth.uid()
  and played = true
);

drop policy if exists "reviews_user_update" on public.character_reviews;
create policy "reviews_user_update"
on public.character_reviews
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "reviews_user_delete" on public.character_reviews;
create policy "reviews_user_delete"
on public.character_reviews
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

create index if not exists idx_character_reviews_character
  on public.character_reviews(character_key);

create index if not exists idx_character_reviews_created
  on public.character_reviews(created_at desc);

drop trigger if exists trg_reviews_updated_at on public.character_reviews;
create trigger trg_reviews_updated_at
before update on public.character_reviews
for each row execute procedure public.set_updated_at();


-- ------------------------------------------------------------
-- CHARACTER LINK EMAIL WAITLIST
-- ------------------------------------------------------------
create table if not exists public.character_notifications (
  id uuid primary key default gen_random_uuid(),
  character_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  subscribed_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (user_id, character_key)
);
alter table public.character_notifications enable row level security;
create table if not exists public.character_links (
  character_key text primary key,
  ggai_url text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.character_links enable row level security;
