-- Run AFTER the admin has signed up once through the website.
-- This changes ONLY the role. Password remains inside Supabase Auth.

update public.profiles
set role = 'admin'
where username = 'bongnilao';

-- Verify:
select id, username, display_name, role, created_at
from public.profiles
where username = 'bongnilao';
