-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — the catalogue as the website ships it
--
--  Run this once, after schema.sql. It puts the same ten rakhis and two
--  sets into the database, so the site keeps showing exactly what it
--  shows now — only from Supabase instead of from the HTML file.
--
--  ⚠ The prices are the sample prices. Change them here, or in
--    Supabase → Table editor → products, before you take real orders.
--
--  Photos: nothing is set here except the one photo you already have.
--  Upload a picture to the product-images bucket and then set
--  image_path to its file name, e.g.
--      update public.products set image_path = 'pearl-rakhi.jpg'
--       where id = 'pearl';
--  Products with image_path null keep showing the drawing, labelled
--  "Drawing", so nobody mistakes it for a photograph.
--
--  Safe to run more than once: it updates rows it already put there.
--
--  ⚠ The last block in this file is the one that makes YOU the seller.
--    Read it before you run the file.
-- ════════════════════════════════════════════════════════════════════

insert into public.products
  (id, kind, name, price, mrp, cat, feat, descr, image_path, art, includes, best)
values
  ('nazar','rakhi','Nazar Evil Eye Rakhi',59,null,'evil-eye',1,
   'Turquoise silk thread, two bands of white seed beads, a hand-painted eye set in a gold-tone frame.',
   'nazar-rakhi.jpg',
   '{"thread":"#3BC4DE","bead":"#FDFCF7","charm":"nazar"}'::jsonb, null, false),

  ('pearl','rakhi','Pearl Bead Rakhi',49,null,'pearl',2,
   'A full cluster of white pearl beads on red and gold thread. Plain enough for anyone.',
   null,
   '{"thread":"#C0272D","bead":"#FDFCF7","charm":"moti"}'::jsonb, null, false),

  ('om','rakhi','Om Kalava Rakhi',39,null,'traditional',3,
   'Plain red and yellow kalava with a gold-tone Om. The simplest thing we make.',
   null,
   '{"thread":"#D4A017","bead":"#C0272D","charm":"om"}'::jsonb, null, false),

  ('rudra','rakhi','Rudraksh Rakhi',79,null,'traditional',4,
   'A real rudraksh bead on ochre thread. For brothers who dislike anything shiny.',
   null,
   '{"thread":"#C97B2E","bead":"#E8D9B8","charm":"rudraksh"}'::jsonb, null, false),

  ('kids','rakhi','Kids Bright Rakhi',49,null,'kids',5,
   'Soft thread, bright colours, a star in the middle. Light enough for a small wrist.',
   null,
   '{"thread":"#2F8F4E","bead":"#FFD447","charm":"star"}'::jsonb, null, false),

  ('lumba','rakhi','Bhabhi Lumba Rakhi',99,null,'lumba',6,
   'Hangs from a bangle instead of tying to the wrist. Flower charm with a bead drop.',
   null,
   '{"thread":"#B5179E","bead":"#FFD447","charm":"ful"}'::jsonb, null, false),

  ('swastik','rakhi','Swastik Thread Rakhi',45,null,'traditional',7,
   'Red swastik on cream enamel, saffron thread. Usually bought for the puja thali.',
   null,
   '{"thread":"#E2762B","bead":"#E5B84B","charm":"swastik"}'::jsonb, null, false),

  ('heart','rakhi','Heart Charm Rakhi',55,null,'kids',8,
   'Red heart on pink thread with gold beads. Doubles as a friendship band.',
   null,
   '{"thread":"#E0507F","bead":"#E5B84B","charm":"dil"}'::jsonb, null, false),

  ('set2','rakhi','Bhaiya–Bhabhi Set',149,null,'lumba',9,
   'One rakhi for bhaiya, one matching lumba for bhabhi, in the same colour family.',
   null,
   '{"thread":"#C0272D","bead":"#FFD447","charm":"dil"}'::jsonb, null, false),

  ('silver','rakhi','Silver-Look Flower Rakhi',199,null,'premium',10,
   'Silver-plated flower on maroon velvet thread. Arrives in a small gift box.',
   null,
   '{"thread":"#7A1F3D","bead":"#E6E8EA","charm":"ful"}'::jsonb, null, false),

  -- the two packs. kind = 'set' keeps them out of the rakhi grid.
  ('s2','set','Two Rakhi Pack',99,118,null,1,
   null, null, null,
   array['Any two rakhis','Roli–chawal sachet','A card, written by hand'], false),

  ('s4','set','Family Pack of Four',179,236,null,2,
   null, null, null,
   array['Any four rakhis','Roli–chawal and mishri','Four cards, a name on each','Delivery free'], true)

on conflict (id) do update set
  kind       = excluded.kind,
  name       = excluded.name,
  price      = excluded.price,
  mrp        = excluded.mrp,
  cat        = excluded.cat,
  feat       = excluded.feat,
  descr      = excluded.descr,
  art        = excluded.art,
  includes   = excluded.includes,
  best       = excluded.best;
  -- image_path is deliberately not overwritten: re-running this file must
  -- never wipe photo names you have set since. Nor is stock, nor cost —
  -- those are yours, and a re-run must not reset a count you have kept.


-- ════════════════════════════════════════════════════════════════════
--  Make yourself the seller
--
--  The dashboard at /admin opens for exactly one kind of account: one
--  whose profile row says role = 'admin'. Neither page can grant that to
--  anyone — which is exactly why nobody can grant it to themselves.
--
--  ⚠ CHANGE THE EMAIL BELOW to the one you will sign in with.
--
--  It does not matter whether you have signed up yet:
--    · not yet  — the trigger makes you an admin the moment you do
--    · already  — the update underneath promotes the account you have
--
--  So: run this file, then open the shop and create an account with that
--  email (or sign in with Google using it), and /admin will open.
--
--  To hand the shop to someone else later, add their email the same way.
--  To take it back, delete their row here and set their profile's role to
--  'customer'.
-- ════════════════════════════════════════════════════════════════════

insert into public.admin_emails (email) values
  (lower('patidarh178@gmail.com'))          -- ← your email
on conflict (email) do nothing;

-- and promote the account if it already exists
update public.profiles p
   set role = 'admin'
  from auth.users u
 where u.id = p.id
   and lower(u.email) in (select email from public.admin_emails)
   and p.role <> 'admin';

-- Check it worked. Before you have signed up this returns nothing, which is
-- fine; after you sign up it should show your email against 'admin'.
select p.email, p.role from public.profiles p where p.role = 'admin';


-- ════════════════════════════════════════════════════════════════════
--  Optional: start counting stock
--
--  Leave stock null and the shop sells a design without counting. Give
--  it a number and every order counts down, the dashboard warns you
--  under five, and you can see what is about to run out.
--  cost is what one costs you to make; fill it in and the dashboard can
--  show margin instead of only revenue.
-- ════════════════════════════════════════════════════════════════════

-- update public.products set stock = 25, cost = 22 where id = 'nazar';
-- update public.products set stock = 40, cost = 18 where id = 'pearl';
