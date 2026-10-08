alter table public.character_reviews
  add column if not exists admin_reply text not null default '' check (char_length(admin_reply) <= 1200),
  add column if not exists admin_reply_at timestamptz;
