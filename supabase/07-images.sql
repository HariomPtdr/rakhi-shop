-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 7: more than one photo
--
--  Run after 01–06. Safe to run twice.
--
--  A handmade rakhi is bought on how it looks, and one photograph cannot
--  show the thread, the bead and the back of it. This adds a gallery.
--
--  products.image_path stays exactly where it was, and is kept in step by
--  a trigger as "the first photo". Everything already written against it —
--  the grid card, the rail, the cart thumbnail, the dashboard row, the
--  shop's fallback drawing — keeps working without being touched. The
--  gallery is additive, which is the only safe way to change the shape of
--  something a dozen other places already read.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.product_images (
  id          bigserial primary key,
  product_id  text not null references public.products (id) on delete cascade,
  path        text not null,                 -- file name inside the bucket
  alt         text,
  sort        integer not null default 0,    -- lowest first; the first is the cover
  created_at  timestamptz not null default now(),
  unique (product_id, path)
);

create index if not exists product_images_idx on public.product_images (product_id, sort, id);

alter table public.product_images enable row level security;

-- the pictures of anything on sale are as public as the rakhi itself
drop policy if exists "product images are public" on public.product_images;
create policy "product images are public" on public.product_images
  for select using (
    exists (select 1 from public.products p
             where p.id = product_images.product_id and (p.active or public.is_admin()))
  );

drop policy if exists "admin adds an image" on public.product_images;
create policy "admin adds an image" on public.product_images
  for insert with check (public.is_admin());

drop policy if exists "admin reorders an image" on public.product_images;
create policy "admin reorders an image" on public.product_images
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin removes an image" on public.product_images;
create policy "admin removes an image" on public.product_images
  for delete using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────
-- the cover, kept in step
--
-- Whatever ends up first in the gallery is what products.image_path says.
-- Reordering the gallery therefore changes the picture on the card, which
-- is what "make this the cover" has to mean.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.sync_cover_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid  text := coalesce(new.product_id, old.product_id);
  v_path text;
begin
  select path into v_path
    from public.product_images
   where product_id = v_pid
   order by sort, id
   limit 1;

  update public.products
     set image_path = v_path            -- null when the last photo goes
   where id = v_pid
     and image_path is distinct from v_path;

  return null;
end;
$$;

drop trigger if exists on_image_change on public.product_images;
create trigger on_image_change
  after insert or update or delete on public.product_images
  for each row execute function public.sync_cover_image();

-- ─────────────────────────────────────────────────────────────────────
-- bring the photos that already exist into the gallery
--
-- Anything with an image_path but no gallery row gets one, so nothing
-- disappears the first time this file runs.
-- ─────────────────────────────────────────────────────────────────────
insert into public.product_images (product_id, path, sort)
select p.id, p.image_path, 0
  from public.products p
 where coalesce(btrim(p.image_path), '') <> ''
   and not exists (select 1 from public.product_images i where i.product_id = p.id)
on conflict (product_id, path) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- reordering, as one call
--
-- p_paths is the gallery in the order it should end up. Doing it in one
-- statement rather than a patch per row means the cover cannot flicker
-- through three different photos while the dashboard saves.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.set_image_order(p_product text, p_paths text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.product_images i
     set sort = x.ord
    from unnest(coalesce(p_paths, '{}'::text[])) with ordinality as x(path, ord)
   where i.product_id = p_product
     and i.path = x.path;
end;
$$;

revoke all on function public.set_image_order(text, text[]) from public;
grant execute on function public.set_image_order(text, text[]) to authenticated;
