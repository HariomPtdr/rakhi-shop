-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 25: the addresses somebody keeps
--
--  Run after 01–24. Safe to run twice.
--
--  Until now an account held exactly one address, in five columns on
--  profiles. That is the right number for someone who orders for
--  themselves and the wrong number for almost everybody who buys a
--  rakhi: it goes to a brother in another city, and next month to a
--  cousin in a third, and the one address on the account is whichever
--  of them was typed last. So every order after the first began by
--  deleting somebody's address to type somebody else's.
--
--  This is the address book. Several per account, one of them the
--  default, each with a label so a list of four is readable at a
--  glance.
--
--  ── the compatibility that matters ──
--  profiles.address and its four companions are NOT retired. A trigger
--  copies the default address back into them on every change, so
--  everything already written against those columns — the bill that
--  fills itself in, the seller's customer list, fillBillFromProfile() —
--  keeps working without knowing this table exists. The address book is
--  the source of truth; those columns are its shadow.
--
--  Orders are untouched either way: an order snapshots the address it
--  was sent to at the moment it was placed, which is what a receipt
--  means. Editing an address here never rewrites where a parcel that
--  has already gone out was going.
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. the book
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,

  -- Home · Work · Other, and nothing else. A free-text label becomes
  -- "home", "Home ", "HOME" and "ghar" in one account, and then the list
  -- cannot be sorted or iconed. Three is enough to tell four addresses
  -- apart, which is the only job a label has here.
  label       text not null default 'Home' check (label in ('Home','Work','Other')),

  -- the same five fields an order carries, checked the same way, because
  -- an address that cannot be delivered to is not worth keeping
  full_name   text not null check (btrim(full_name) <> ''),
  phone       text not null check (phone ~ '^[6-9][0-9]{9}$'),
  address     text not null check (btrim(address) <> ''),
  city        text not null check (btrim(city) <> ''),
  pincode     text not null check (pincode ~ '^[0-9]{6}$'),

  -- what to tell the courier when they are outside the building
  note        text check (note is null or length(note) <= 400),

  -- the dropped pin, when there is one. Same pair of columns as orders
  -- and profiles carry, so 08-location.sql's link builder works on it.
  lat         numeric(9,6),
  lng         numeric(9,6),
  constraint addresses_latlng_pair check (
    (lat is null and lng is null)
    or (lat between -90 and 90 and lng between -180 and 180)),

  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists addresses_mine_idx
  on public.addresses (user_id, created_at desc);

-- One default per account, enforced by the database rather than by the
-- page. Two defaults is not a cosmetic bug: it is a bill that fills
-- itself in from whichever row came back first.
create unique index if not exists addresses_one_default_idx
  on public.addresses (user_id) where is_default;

-- ─────────────────────────────────────────────────────────────────────
-- 2. who may read and write them
-- ─────────────────────────────────────────────────────────────────────
-- Yours, and nobody else's — not even the seller's. The seller has no
-- business reading the address book: they get the address on an order,
-- which is the one that was actually used, and they get it because the
-- order carries a copy of it.
alter table public.addresses enable row level security;

drop policy if exists "read own addresses"   on public.addresses;
drop policy if exists "add own addresses"    on public.addresses;
drop policy if exists "edit own addresses"   on public.addresses;
drop policy if exists "delete own addresses" on public.addresses;

create policy "read own addresses" on public.addresses
  for select using (user_id = auth.uid());

create policy "add own addresses" on public.addresses
  for insert with check (user_id = auth.uid());

create policy "edit own addresses" on public.addresses
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "delete own addresses" on public.addresses
  for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- 3. keeping exactly one default, without asking the page to
-- ─────────────────────────────────────────────────────────────────────
-- The unique index above refuses a second default. It does not choose
-- which one loses, and a page that has to unset the old one first can
-- be interrupted between the two writes and leave an account with none.
-- So marking a row default here unmarks the others in the same
-- statement, and the first address ever added becomes the default
-- because an address book of one has an obvious answer.
create or replace function public.addresses_one_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
     and not exists (select 1 from public.addresses where user_id = new.user_id) then
    new.is_default := true;
  end if;

  if new.is_default then
    update public.addresses
       set is_default = false, updated_at = now()
     where user_id = new.user_id
       and id <> new.id
       and is_default;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists addresses_one_default_t on public.addresses;
create trigger addresses_one_default_t
  before insert or update on public.addresses
  for each row execute function public.addresses_one_default();

-- Deleting the default leaves the account with none, and then the bill
-- stops filling itself in for somebody who still has three addresses
-- saved. The newest of what is left takes over.
create or replace function public.addresses_promote_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_default then
    update public.addresses
       set is_default = true
     where id = (select id from public.addresses
                  where user_id = old.user_id
                  order by created_at desc
                  limit 1);
  end if;
  -- the shadow on profiles follows whatever happened
  perform public.sync_default_address(old.user_id);
  return old;
end;
$$;

drop trigger if exists addresses_promote_t on public.addresses;
create trigger addresses_promote_t
  after delete on public.addresses
  for each row execute function public.addresses_promote_after_delete();

-- ─────────────────────────────────────────────────────────────────────
-- 4. the shadow on profiles
-- ─────────────────────────────────────────────────────────────────────
-- Everything written before this file reads the address off profiles.
-- Rather than find and change every one of those places — the bill, the
-- seller's customer list, the prefill — the default address is copied
-- there whenever it changes. One source of truth, one derived copy,
-- maintained by the database so it cannot drift.
create or replace function public.sync_default_address(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.addresses;
begin
  select * into a from public.addresses
   where user_id = p_user and is_default limit 1;

  if a.id is null then
    return;    -- the book is empty; leave what profiles already had
  end if;

  update public.profiles
     set full_name  = a.full_name,
         phone      = a.phone,
         address    = a.address,
         city       = a.city,
         pincode    = a.pincode,
         lat        = coalesce(a.lat, lat),
         lng        = coalesce(a.lng, lng),
         updated_at = now()
   where id = p_user;
end;
$$;

create or replace function public.addresses_sync_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_default_address(new.user_id);
  return new;
end;
$$;

drop trigger if exists addresses_sync_profile_t on public.addresses;
create trigger addresses_sync_profile_t
  after insert or update on public.addresses
  for each row execute function public.addresses_sync_profile();

-- ─────────────────────────────────────────────────────────────────────
-- 5. saving one, in a single call
-- ─────────────────────────────────────────────────────────────────────
-- The page could insert and update through the REST API directly — the
-- policies above allow it. It goes through this instead for one reason:
-- validation lives in one place, and that place is the database. A
-- pincode that is five digits is refused whether it arrives from the
-- shop, from a script, or from somebody typing into the API by hand.
create or replace function public.save_address(
  p_id      uuid,
  p_label   text,
  p_name    text,
  p_phone   text,
  p_address text,
  p_city    text,
  p_pincode text,
  p_note    text default null,
  p_default boolean default false,
  p_lat     numeric default null,
  p_lng     numeric default null
)
returns public.addresses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.addresses;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'A name is needed — the courier asks for it.';
  end if;
  if p_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'That phone number does not look right.';
  end if;
  if coalesce(btrim(p_address), '') = '' or coalesce(btrim(p_city), '') = '' then
    raise exception 'Fill the address and the city.';
  end if;
  if p_pincode !~ '^[0-9]{6}$' then
    raise exception 'A pincode is six digits.';
  end if;

  if p_id is null then
    -- Six is not a limit anybody will meet honestly; it is there so a
    -- broken loop cannot fill the table.
    if (select count(*) from public.addresses where user_id = v_uid) >= 12 then
      raise exception 'That is as many addresses as an account keeps. Remove one first.';
    end if;

    insert into public.addresses
      (user_id, label, full_name, phone, address, city, pincode, note, is_default, lat, lng)
    values
      (v_uid, coalesce(p_label, 'Home'), btrim(p_name), btrim(p_phone), btrim(p_address),
       btrim(p_city), btrim(p_pincode), nullif(btrim(coalesce(p_note, '')), ''),
       coalesce(p_default, false), p_lat, p_lng)
    returning * into v_row;
  else
    update public.addresses
       set label      = coalesce(p_label, label),
           full_name  = btrim(p_name),
           phone      = btrim(p_phone),
           address    = btrim(p_address),
           city       = btrim(p_city),
           pincode    = btrim(p_pincode),
           note       = nullif(btrim(coalesce(p_note, '')), ''),
           is_default = coalesce(p_default, is_default),
           lat        = coalesce(p_lat, lat),
           lng        = coalesce(p_lng, lng)
     where id = p_id and user_id = v_uid
    returning * into v_row;

    if v_row.id is null then
      raise exception 'not your address' using errcode = '42501';
    end if;
  end if;

  return v_row;
end;
$$;

-- Making one the default is its own call, because it is its own action:
-- from the list, one tap, without opening the form and saving six fields
-- that did not change.
create or replace function public.set_default_address(p_id uuid)
returns public.addresses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.addresses;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  update public.addresses set is_default = true
   where id = p_id and user_id = v_uid
  returning * into v_row;

  if v_row.id is null then
    raise exception 'not your address' using errcode = '42501';
  end if;
  return v_row;
end;
$$;

revoke all on function public.save_address(uuid, text, text, text, text, text, text, text, boolean, numeric, numeric) from public;
revoke all on function public.set_default_address(uuid) from public;
grant execute on function public.save_address(uuid, text, text, text, text, text, text, text, boolean, numeric, numeric) to authenticated;
grant execute on function public.set_default_address(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 6. the address everybody already had
-- ─────────────────────────────────────────────────────────────────────
-- Every account with a complete address on profiles gets it as the first
-- row of its address book, labelled Home and marked default — so nobody
-- opens the new screen to find the address they have been ordering with
-- for a year has vanished. Accounts that already have a row are skipped,
-- which is what makes this file safe to run twice.
insert into public.addresses
  (user_id, label, full_name, phone, address, city, pincode, lat, lng, is_default)
select p.id, 'Home', p.full_name, p.phone, p.address, p.city, p.pincode, p.lat, p.lng, true
  from public.profiles p
 where p.full_name is not null and btrim(p.full_name) <> ''
   and p.phone   ~ '^[6-9][0-9]{9}$'
   and p.address is not null and btrim(p.address) <> ''
   and p.city    is not null and btrim(p.city) <> ''
   and p.pincode ~ '^[0-9]{6}$'
   and not exists (select 1 from public.addresses a where a.user_id = p.id);

-- ────────────────────────────────────────────────────────────────────
--  Done. The account now keeps an address book; profiles still shows
--  the default one to everything that was reading it before.
-- ────────────────────────────────────────────────────────────────────
