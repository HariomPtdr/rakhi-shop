-- ══════════════════════════════════════════════════════════
-- tags on a rakhi
--
-- A rakhi has exactly one `cat` — the shelf it lives on, and the
-- thing the chips at the top of the collection sort by. That is one
-- answer to "what is this", and most rakhis have several: an evil
-- eye rakhi can also be a designer one, a kids one can also be a
-- cartoon one, and a bhaiya-bhabhi set is both a set and a lumba.
--
-- `cat` cannot answer that without becoming a list, and the moment
-- it is a list it stops being able to say which shelf the thing
-- goes on. So: cat stays as it is, and tags carry everything else.
--
-- This matters most when a batch goes up at once. Twenty photographs
-- uploaded in one sitting each need a shelf, which is a decision;
-- tags are how the rest of what you already know about them gets
-- written down while you are still looking at them, instead of being
-- lost and re-derived later.
--
-- text[] rather than a tags table with a join: this is read on every
-- visit as part of the catalogue, it is never counted or reported on,
-- and there is no such thing as a tag that exists apart from the
-- rakhis wearing it. The GIN index is what makes `tags @> '{kids}'`
-- an index scan rather than a walk through every row.
-- ══════════════════════════════════════════════════════════

alter table public.products
  add column if not exists tags text[] not null default '{}';

create index if not exists products_tags_idx
  on public.products using gin (tags);

comment on column public.products.tags is
  'Free-form labels shown on the card and filterable in the shop. '
  'Lowercase, hyphenated, no duplicates — the dashboard normalises '
  'on save. Distinct from cat, which is the one shelf a rakhi sits on.';
