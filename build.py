#!/usr/bin/env python3
"""
Ray Art Gallery — build.

    python3 build.py

Reads the source in src/ and writes dist/, which is what gets published.

  src/shop/index.html    the shop.  Open it directly in a browser to work on
                         it: the stylesheets and scripts are ordinary <link>
                         and <script src> tags, so there is nothing to run
                         while you edit.
  src/admin/index.html   the seller dashboard, the same way.
  src/shared/            the parts both pages use: the environment, the
                         formatting, the Supabase client.

What comes out:

  dist/index.html        the shop, with every stylesheet and script inlined
                         — one file, no extra requests.
  dist/admin/index.html  the dashboard, the same.
  dist/assets/           fonts and photos.
  dist/share.html        the shop with the photos and fonts embedded as
                         data URIs too: one file that works with no server
                         and no internet. Send it on WhatsApp.

The Supabase keys are written in here, at build time, from .env or from the
environment (which wins — that is how Netlify sets them). Nothing secret is
involved: the publishable key belongs in the page, and row level security is
what protects the data. See docs/DEPLOY.md.
"""
import base64, mimetypes, os, pathlib, re, shutil, sys

HERE   = pathlib.Path(__file__).parent.resolve()
SRC    = HERE / "src"
DIST   = HERE / "dist"
ASSETS = HERE / "assets"

# ── the environment ──────────────────────────────────────────────────
# Netlify (and any CI) sets real environment variables; .env is the local
# convenience. The real environment wins so a deploy can never be
# accidentally pinned to whatever is in a file on someone's laptop.
WANTED = ("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_BUCKET", "ADMIN_PATH",
          "RAZORPAY_KEY_ID", "CDN_URL", "SITE_URL", "API_BASE")

# the same three values under the names other tools like to use
ALIASES = {
    "SUPABASE_URL": ("NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL"),
    "SUPABASE_ANON_KEY": (
        "NEXT_PUBLIC_SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY",
    ),
    "SUPABASE_BUCKET": ("NEXT_PUBLIC_SUPABASE_BUCKET",),
}


def read_env():
    env = {k: "" for k in WANTED}
    dotenv = HERE / ".env"
    if dotenv.exists():
        for line in dotenv.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    for key in WANTED:
        for name in (key,) + ALIASES.get(key, ()):
            if os.environ.get(name):
                env[key] = os.environ[name].strip()
                break
        else:
            if not env.get(key):
                for name in ALIASES.get(key, ()):
                    if env.get(name):
                        env[key] = env[name]
                        break
    if not env.get("SUPABASE_BUCKET"):
        env["SUPABASE_BUCKET"] = "product-images"

    # Where the dashboard is published. Anything a stranger would not guess.
    # Slashes are allowed so it can be nested; everything else is stripped,
    # because this becomes a folder name and part of a URL.
    path = re.sub(r"[^a-z0-9\-_/]", "", (env.get("ADMIN_PATH") or "admin").lower())
    path = "/".join(p for p in path.split("/") if p) or "admin"
    env["ADMIN_PATH"] = path

    # Where the payment functions answer, when they are not reached at /api.
    # A trailing slash here would build //rzp-create-order, which some hosts
    # answer and some do not, so it is taken off once rather than guarded at
    # every call site.
    env["API_BASE"] = env.get("API_BASE", "").strip().rstrip("/")
    if env["API_BASE"] and not env["API_BASE"].startswith("https://"):
        sys.exit(f"\n  API_BASE must be an https:// address, not {env['API_BASE']!r}.\n"
                 "  Payments and a sign-in token travel over it.\n")

    if env["SUPABASE_ANON_KEY"].startswith("sb_secret") or "service_role" in env["SUPABASE_ANON_KEY"]:
        sys.exit("\n  STOP. That looks like a service_role/secret key.\n"
                 "  It bypasses every security rule and must never be built into a page.\n"
                 "  Use the publishable (anon) key instead.\n")
    return env


ENV = read_env()

# ── assembling a page ────────────────────────────────────────────────
LINK = re.compile(r'[ \t]*<link rel="stylesheet" href="([^"]+)">\n?')
SCRIPT = re.compile(r'[ \t]*<script src="([^"]+)"></script>\n?')
ASSET = re.compile(r'(?:\.\./)+assets/')

inlined_bytes = 0


def env_js(text):
    """Write the three values into the copy of 00-env.js being inlined."""
    for key, val in ENV.items():
        text = re.sub(r'(%s:\s*)"[^"]*"' % key, lambda m: m.group(1) + '"%s"' % val, text)
    return text


def load(page_dir, ref):
    path = (page_dir / ref).resolve()
    if not path.exists():
        sys.exit(f"  MISSING: {ref}  (referenced from {page_dir.relative_to(HERE)}/index.html)")
    text = path.read_text(encoding="utf-8")
    if path.name == "00-env.js":
        text = env_js(text)
    if path.suffix == ".js" and "</script" in text:
        sys.exit(f"  {ref} contains '</script' — it cannot be inlined. Split the string.")
    global inlined_bytes
    inlined_bytes += len(text.encode("utf-8"))
    return text


def assemble(page, depth):
    """page: the directory under src/. depth: how deep the output sits in dist/."""
    page_dir = SRC / page
    html = (page_dir / "index.html").read_text(encoding="utf-8")

    html = LINK.sub(lambda m: "<style>\n%s</style>\n" % load(page_dir, m.group(1)), html)
    html = SCRIPT.sub(lambda m: "<script>\n%s</script>\n" % load(page_dir, m.group(1)), html)

    # Every reference walked up out of src/ to reach assets/. Now that the
    # page is one file in dist/, point them at where assets actually is.
    html = ASSET.sub("../" * depth + "assets/", html)

    # ── the link preview, and what search engines are told ──
    # A scraper never runs JavaScript, so og:url, og:image and canonical
    # have to be absolute and written in at build time.
    #
    # Unset, they are removed rather than left as example.com. A preview
    # with no image is a missed opportunity; a canonical pointing at a
    # domain somebody else owns tells Google the real page is theirs.
    site = (ENV.get("SITE_URL") or "").rstrip("/")
    if site:
        html = html.replace("https://example.com", site)
    else:
        html = re.sub(r'[ \t]*<meta property="og:(url|image|image:alt)"[^>]*>\n?', "", html)
        html = re.sub(r'[ \t]*<link rel="canonical"[^>]*>\n?', "", html)
        html = re.sub(r'[ \t]*<meta name="twitter:card"[^>]*>\n?', "", html)
    return html


def embed_assets(html):
    """share.html: no folder beside it, so the files go inside it."""
    def one(m):
        quote, ref = m.group(1), m.group(2)
        path = (DIST / ref).resolve()
        if not path.exists():
            return m.group(0)
        mime = "font/woff2" if path.suffix == ".woff2" else \
               (mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        b64 = base64.b64encode(path.read_bytes()).decode("ascii")
        return f"{quote}data:{mime};base64,{b64}{quote}"
    return re.sub(r'(["\'])(assets/[^"\']+)\1', one, html)


# ── build ────────────────────────────────────────────────────────────
if DIST.exists():
    shutil.rmtree(DIST)
DIST.mkdir()
shutil.copytree(ASSETS, DIST / "assets")

shop = assemble("shop", depth=0)
(DIST / "index.html").write_text(shop, encoding="utf-8")
print(f"  dist/index.html          {len(shop) / 1024:7.0f} KB")

if (SRC / "admin" / "index.html").exists():
    admin_path = ENV["ADMIN_PATH"]
    depth = admin_path.count("/") + 1
    admin = assemble("admin", depth=depth)
    out = DIST / admin_path
    out.mkdir(parents=True)
    (out / "index.html").write_text(admin, encoding="utf-8")
    print(f"  dist/{admin_path}/index.html".ljust(25) + f"{len(admin) / 1024:7.0f} KB")

    admin_rule = (
        # Keep it out of every index, wherever it is published. No host
        # config can know the path, so the rule is written here beside
        # the page.
        #
        # Deliberately NOT a robots.txt Disallow line: robots.txt is world
        # readable, so disallowing a secret path is how you publish it. The
        # header tells a crawler not to index the page without naming it to
        # anyone who did not already have the address.
        "\n/%s/*\n  X-Robots-Tag: noindex, nofollow\n"
        "  Cache-Control: public, max-age=0, must-revalidate\n" % admin_path)
else:
    admin_rule = ""

# ── the headers, in the one file every host reads ──
# Netlify and Cloudflare Pages both understand _headers. Written here rather
# than in a host's own config so that moving hosts does not silently drop the
# security headers — the ones that are easy to lose and hard to notice.
(DIST / "_headers").write_text(
    "/*\n"
    "  X-Content-Type-Options: nosniff\n"
    "  Referrer-Policy: strict-origin-when-cross-origin\n"
    "  X-Frame-Options: SAMEORIGIN\n"
    "  Permissions-Policy: geolocation=(), camera=(), microphone=(), interest-cohort=()\n"
    # Fonts and photos are content-addressed by their own names and change
    # only when replaced, so they can be cached hard. The pages must not be:
    # a price change has to reach the next visitor.
    "\n/assets/*\n"
    "  Cache-Control: public, max-age=31536000, immutable\n"
    "\n/index.html\n"
    "  Cache-Control: public, max-age=0, must-revalidate\n"
    + admin_rule, encoding="utf-8")

share = embed_assets(shop)
(DIST / "share.html").write_text(share, encoding="utf-8")
print(f"  dist/share.html          {len(share) / 1024:7.0f} KB   <- send this to anyone")

n_assets = sum(1 for _ in (DIST / "assets").rglob("*") if _.is_file())
print(f"  dist/assets/             {n_assets:7d} files")

print()
if ENV["SUPABASE_URL"] and ENV["SUPABASE_ANON_KEY"]:
    print(f"  Supabase   {ENV['SUPABASE_URL']}")
    print(f"             key {ENV['SUPABASE_ANON_KEY'][:14]}…  bucket {ENV['SUPABASE_BUCKET']}")
else:
    print("  Supabase   not configured — accounts, orders, wishlists and the")
    print("             dashboard are off. The shop itself works. See docs/DEPLOY.md.")

mb = (DIST / "share.html").stat().st_size / 1024 / 1024
if mb > 15:
    print("\n  share.html is too big for WhatsApp. Shrink the photos first:", file=sys.stderr)
    print("    sips -Z 900 assets/images/*.jpg -s formatOptions 75", file=sys.stderr)
