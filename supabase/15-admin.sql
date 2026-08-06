-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 15: a second owner
--
--  Run after 01–14. Safe to run twice.
--
--  Handing the dashboard to somebody has always been one line of SQL,
--  deliberately: nothing on either page can promote an account, which is
--  the only reason nobody can promote themselves. This is that line,
--  written down so it is not retyped from memory at midnight.
--
--  Both halves matter, and which one does the work depends on whether
--  the person has signed up yet:
--
--    admin_emails  — the list the sign-up trigger checks. An address on
--                    it becomes an admin the moment an account is made,
--                    however they sign in, so the order of "make an
--                    account" and "give them the dashboard" stops
--                    mattering.
--    profiles      — for an account that already exists, which the
--                    trigger will never run for again.
--
--  To take it back, the last statement is at the bottom, commented out.
-- ════════════════════════════════════════════════════════════════════

insert into public.admin_emails (email)
values ('ray.tejra@gmail.com')
on conflict (email) do nothing;

update public.profiles
   set role = 'admin'
 where lower(btrim(email)) = 'ray.tejra@gmail.com';

-- what happened, so the result is not a guess:
--   'promoted'  the account existed and is now an owner
--   'listed'    no account yet — it becomes one on sign-up
select case
         when exists (select 1 from public.profiles
                       where lower(btrim(email)) = 'ray.tejra@gmail.com'
                         and role = 'admin')
         then 'promoted — they can open the dashboard now'
         else 'listed — they become an owner the moment they sign up'
       end as result;

-- ── taking it away again ──
-- update public.profiles set role = 'customer'
--  where lower(btrim(email)) = 'ray.tejra@gmail.com';
-- delete from public.admin_emails where email = 'ray.tejra@gmail.com';
