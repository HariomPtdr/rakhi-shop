# How the code is laid out

```
rakhi-shop/
├── build.py               assembles dist/ from src/. The whole build.
├── netlify.toml           build command, headers, caching
├── .env                   the two Supabase values. Not in git.
│
├── src/
│   ├── shared/            what both pages use
│   │   ├── js/00-env.js       the environment, written in at build time
│   │   ├── js/01-format.js    money, dates, the order statuses
│   │   ├── js/02-sb.js        the Supabase client — sessions, REST, storage
│   │   └── styles/00-tokens.css  fonts, colours, the reset
│   │
│   ├── shop/              the shop
│   │   ├── index.html         the markup, and the list of parts below it
│   │   ├── styles/  02 … 17   one file per thing it dresses
│   │   └── js/      01 … 19   one file per thing it does
│   │
│   └── admin/             the seller dashboard
│       ├── index.html
│       ├── styles/01-admin.css
│       └── js/      01 … 09   one file per screen
│
├── supabase/
│   ├── 01-schema.sql      tables, security, cart and order functions
│   ├── 02-admin.sql       the seller: policies and the five reports
│   └── 03-seed.sql        the catalogue, and the line that makes you the seller
│
├── assets/                fonts and photos
├── docs/                  this, and the three beside it
└── dist/                  built. Not in git — build.py makes it.
```

## Why the numbers on the filenames

The scripts are plain `<script src>` tags, not modules, and they share one
scope — exactly as they did when all of this was a single 3,946-line file. The
numbers are the load order, and the load order is the dependency order: the
settings and the catalogue first, then the things that draw, then the things
that wire them up.

That is what makes the split safe. Nothing was rewritten to make it possible:
the same code runs in the same order, only in files you can find things in.

It also means **a name can only be declared once across all of them**. Two files
that both say `const esc = …` is a syntax error, not a shadowed variable. If you
add something shared, put it in `src/shared/`.

## What build.py actually does

1. Reads `.env` and the real environment, and writes the two values into its
   copy of `00-env.js`.
2. Reads `src/shop/index.html`, replaces every `<link rel="stylesheet">` and
   `<script src>` with the file's contents inline, and writes
   `dist/index.html` — one file, no extra requests.
3. The same for `src/admin/index.html` → `dist/admin/index.html`.
4. Copies `assets/` into `dist/assets/`, fixing the `../../` in the paths now
   that the pages have moved.
5. Writes `dist/share.html`: the shop again, with the fonts and photos embedded
   as data URIs, so it works with no server and no internet.

## Working on it

Open `src/shop/index.html` in a browser. It works: the links and scripts resolve
as they are, and there is nothing to run while you edit.

Only two things need a build — Supabase, because the keys are written in at that
point, and `share.html`.

## Adding a file

Drop it in `src/shop/js/` or `src/shop/styles/`, numbered where it belongs in
the order, and add the tag to `src/shop/index.html` in the same place. `build.py`
follows the tags; there is no manifest to keep in step.

## The one archive

`docs/single-file-original.html` is the shop as it was before the split, kept so
you can diff against it if something ever looks different. Nothing reads it.
Delete it whenever you are satisfied.
