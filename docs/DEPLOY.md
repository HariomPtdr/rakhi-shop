# Building and publishing

## The environment

Two values decide whether the shop has a back end. They live in `.env`, which is
in `.gitignore` and never committed:

```
SUPABASE_URL=https://bvyuoznbmffwvzzwdlfs.supabase.co
SUPABASE_ANON_KEY=sb_publishable_…
SUPABASE_BUCKET=product-images
```

`build.py` reads them and writes them into the pages it produces. Real
environment variables win over `.env`, which is how Netlify sets them without a
file existing at all.

`NEXT_PUBLIC_SUPABASE_URL`, `VITE_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are accepted as aliases, so pasting from
another project's settings works without renaming anything.

Leave them empty and everything still builds: the shop keeps the basket on the
phone, shows the catalogue written into its own JavaScript, and makes no network
requests at all. The dashboard says it is not connected.

**Never put the `service_role` / `sb_secret_…` key here.** It bypasses every
security rule. Nothing in this project uses it, and `build.py` stops with an
error if it sees one.

## Building

```sh
python3 build.py
```

```
dist/index.html          the shop — every stylesheet and script inlined,
                         so the published page makes no extra request
dist/admin/index.html    the seller dashboard
dist/assets/             fonts and photos
dist/share.html          the shop with the photos and fonts embedded as
                         data URIs as well: one file that works with no
                         server and no internet. Send it on WhatsApp.
```

Nothing else is needed — no npm, no node_modules, no framework. Python 3 is
already on macOS and on Netlify's build image.

## Working on it

Open `src/shop/index.html` (or `src/admin/index.html`) straight in a browser.
The stylesheets and scripts are ordinary `<link>` and `<script src>` tags, so
your changes are one refresh away and there is nothing to run while you edit.

Two things only work in the built page: **Supabase**, because the keys are
written in at build time, and **share.html**. To test those, build and use
`dist/`:

```sh
python3 build.py && (cd dist && python3 -m http.server 8000)
```

then open `http://localhost:8000` and `http://localhost:8000/admin/`.

---

## Netlify

`netlify.toml` is already here: build command `python3 build.py`, publish
directory `dist`.

### First time

1. Push this folder to GitHub, or drag it into **netlify.com → Add new site →
   Import an existing project**.
2. Netlify reads `netlify.toml`, so the build command and publish directory are
   already right — do not change them.
3. **Site configuration → Environment variables → Add a variable**, twice:

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | `https://bvyuoznbmffwvzzwdlfs.supabase.co` |
   | `SUPABASE_ANON_KEY` | your `sb_publishable_…` key |

4. **Deploys → Trigger deploy → Deploy site.** The variables are only read at
   build time, so a site deployed before you added them needs one more deploy.

### Or from this machine

```sh
npx netlify-cli deploy --build --prod
```

The first run asks you to log in and to pick or create a site.

### After it is live

- The shop is at `https://<your-site>.netlify.app/`
- The dashboard is at `https://<your-site>.netlify.app/admin/`
- Set your own domain under **Domain management**. HTTPS is automatic.
- In `src/shop/index.html`, replace the two `https://example.com` values in the
  `og:` tags and the canonical link with the real address, then build again.
  That is what WhatsApp shows when someone shares the link.

### What the config does

- The two pages are never cached; `assets/` is cached for a year. A price change
  reaches the next visitor, and nobody re-downloads the fonts.
- `/admin/*` is served with `X-Robots-Tag: noindex`. It is protected by the
  database, not by being hard to find, but there is no reason for it to appear
  in a search result.
- The usual header hardening: `nosniff`, `SAMEORIGIN`, a strict referrer policy.

---

## Anywhere else

It is a folder of static files. `dist/` uploads to Vercel, GitHub Pages,
Cloudflare Pages or any web host as it is — with one catch: those need
`python3 build.py` to have been run **with the environment set**, either locally
before uploading or as their own build step. Vercel and Cloudflare can run it
the same way Netlify does; GitHub Pages cannot, so build locally and push
`dist/`.
