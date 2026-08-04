# Nebro — Website & Admin Panel

A multi-page marketing site plus an admin dashboard UI, on a compiled
Tailwind CSS production build. No server or build step needed to run it.

## Files
| File | Purpose |
|---|---|
| `index.html` | Home — hero slideshow, specializations, trust/stats |
| `about.html` | About Us |
| `products.html` | Product catalog with category filtering |
| `industries.html` | Industries served |
| `case-studies.html` | Case studies |
| `resources.html` | Guides, spec sheets, FAQ |
| `contact.html` | Quote request form |
| `admin.html` | Admin dashboard — products, case studies, inquiries, reports, settings |
| `style.css` | Shared design system |
| `tailwind.css` | Compiled, purged Tailwind (production build) |
| `script.js` | Shared front-end behavior (nav, animations, slideshow, filters, AI widget) |
| `admin.js` | Admin dashboard behavior (in-memory data) |
| `vendor/` | Locally hosted Chart.js, jsPDF, SheetJS — no CDN dependency |
| `logo.png` | Company logo / favicon |

## Running it
Open `index.html` in a browser. Keep the whole folder together.

## What's real vs. placeholder
**Real / working:** all layouts and responsive nav, light/dark theme toggle
(top-right, persists via localStorage), animated hero with overlapping photo
composition, word-by-word headline animation, stats that count up every time
they scroll into view, hover switchers, product filter + hover "Request a
Quote" overlay, Quote/Appointment tab toggle on Contact, admin view
switching, publish/unpublish/delete, add-product with photo upload (now
saved to Supabase Storage), roles table, reports charts (Chart.js, vendored
locally), working PDF and Excel export, WhatsApp button (real wa.me link),
AI assistant widget (canned front-end responses only).

**Placeholder — needs real content:**
- About page team section (Amani Joseph / Fatuma Rashidi / Baraka Mwakalinga) —
  invented placeholder names, swap for your real team's names/titles/photos
- Resources page articles — placeholder blog posts, swap for real content
- Contact page map — static placeholder, add a real Google Maps embed link
- Notification preferences UI — needs the backend wiring below to actually send alerts

**Placeholder — needs backend to go live:**
- Contact form (wire to Web3Forms/Formspree, or your own API)
- Admin data (products/inquiries/users) — resets on refresh
- Roles & permissions — UI only, no real authentication yet
- Notification preferences — UI only, no email/SMS actually sends
- Visitor analytics / location — not built here; use a real analytics tool (see below)

## What's new in this pass
- **Products page is now live-data-driven**: if the `products` table has
  published rows, `products.html` renders them (with real photos where
  uploaded, icon fallback otherwise) instead of the static sample cards.
  Falls back to the static cards if no backend is connected yet.
- **Site Images**: 8 key photo spots — the 3 hero photos, the 3 "What We
  Supply" category images, the About Mission photo, and the Commitment
  section photo — are now uploadable from Admin → Site Content → Site
  Images. Upload replaces the icon placeholder on the live site
  immediately, stored in the `site-images` Storage bucket.
- **Removed the duplicate photo composition** from "What We Supply" —
  the 3 overlapping photos now live only in the Hero, as intended.
  "What We Supply" instead got each category panel's own icon-accent
  grid expanded from 2 images to 4.
- **Mobile pass**: fixed the hero photo composition's height (was a fixed
  420px on every screen size, now scales 300px → 360px → 420px by
  breakpoint) and re-verified every page at 390px width — zero horizontal
  overflow, zero JS errors, at both mobile and desktop viewports.

## This round: real company data + two real bugs fixed

**Bug #1 — the spinning seal wasn't showing on phones at all.** The CTA
banner's seal was set to `hidden` below desktop width (`hidden lg:flex`),
so on mobile it wasn't just failing to animate — it wasn't rendering at
all. Fixed: now shows at every screen size (smaller on phones), and I
verified via the browser's Animation API that it's actually running,
not just visually appearing to.

**Bug #2 — SVG rotation cross-browser fix.** Added `transform-box:
fill-box` to the rotating ring text, which is required for consistent
rotation behavior on mobile Safari/Chrome (the default `transform-box`
for SVG differs from HTML elements and can cause animations to rotate
around the wrong point or appear invisible).

**Handshake icon redesigned** to better resemble your actual logo — a
solid leaf-shaped hand with distinct finger-gap lines, replacing the
looser hand-drawn line art from before.

**Real company data applied**, pulled from your Company Profile PDF:
- Phone: `+255 746 448 226` (was a placeholder) — updated in every tel:
  link, WhatsApp link, and displayed number sitewide
- Address: `Darhomey Street, Ada Estate, P.O. Box 11566` (was placeholder)
  — updated everywhere including Google Maps links
- About page: real Mission & Vision text, all 8 real core values
  (was 3 invented placeholders), real "Who We Are" story including your
  actual registration numbers (BRELA No. 181607947, TIN 181-607-947,
  Business License No. BL01396912024-2500025470)
- About page stats: replaced inflated/unsubstantiated numbers (200+
  partners, 6+ countries, 5000+ equipment) with real, defensible ones
  from your profile: Established 2024, 21+ Active Supply Contracts,
  15 Medical Representatives, TFDA Registered & Licensed

**To push this live**, since your Supabase database already has the
*old* placeholder footer/hero text seeded (editing the migration file
doesn't retroactively change already-existing rows), run this once in
the SQL Editor to fix your live footer:
```sql
update public.site_content
set value = '{"blurb":"Fast-growing pharmaceutical and medical goods supplier, serving hospitals, clinics, and healthcare facilities across Tanzania and East Africa.","address":"Darhomey Street, Ada Estate","phone":"+255 746 448 226"}'
where key = 'footer';
```
(Or just use Admin → Site Content → Footer form — same result, no SQL needed.)

**Team members — update via the admin panel, not code.** Your profile
lists real management (Brown Kaswela – Managing Director, Hellen Kaswela
– Director, Kiteto Abdurhaman – Operations Manager, Emmanuel Mfinanga –
Marketing Manager, and more). Go to Admin → Team and replace the 3
placeholder entries with real names/titles — this is exactly what that
feature is for, no code change needed.

## This round: real domain + brand name update
- All SEO references (`robots.txt`, `sitemap.xml`, canonical/OG/Twitter
  tags on every page) now point to **https://www.nebro.co.tz** instead
  of the placeholder Vercel URL.
- Brand name updated to **"Nebro Company"** everywhere it appears —
  header/footer logo text, page titles, meta descriptions, About page
  copy, footer copyright, email templates in the Edge Functions, and the
  AI assistant's own name and system prompt. Checked at both 1440px and
  down to 375px width — the longer name doesn't overflow the header.
- **Supabase Auth Site URL**: go to Supabase dashboard → Authentication
  → URL Configuration → update **Site URL** to `https://www.nebro.co.tz`
  (currently likely still your `.vercel.app` URL) — otherwise future
  auth emails (invites, password resets) will link to the old address.

## This round: Industries + Case Studies CMS, and SEO

**Run this new incremental migration** (SQL Editor, after your previous two):
```
supabase/migrations/0003_case_studies_and_industries.sql
```
This adds a `photo_url` column to the existing `case_studies` table and
creates a new `industries` table, seeded with the current 6 industries.

**Case Studies is now real** — Admin → Case Studies: add/edit/delete,
upload a photo, toggle Published/Draft. The public Case Studies page
fetches published ones and shows **newest first** — so the moment you
add one in admin, it appears at the top of the live page. No more static
sample cards (those only remain as a fallback if the table is empty or
the backend isn't connected).

**Industries is now real** — same pattern: Admin → Industries, with
title/description/photo/display order/published toggle. Public Industries
page renders them in your chosen order.

**SEO basics added:**
- `robots.txt` — allows all pages to be indexed, blocks `/admin.html`
  and `/login.html` from search engines, points to the sitemap
- `sitemap.xml` — lists all 7 public pages
- Every public page now has a canonical URL, Open Graph tags (title,
  description, image, url), and Twitter Card tags — these are what
  make links look good when shared on WhatsApp/Facebook/X/LinkedIn,
  and help Google understand each page

**One thing to update yourself:** both `robots.txt`, `sitemap.xml`, and
every page's canonical/OG tags currently point to
`https://nebrohealthcare.vercel.app` — if you connect a custom domain
later, find-and-replace that URL across these files with your real
domain (a quick job, just search for `nebrohealthcare.vercel.app` in
the project folder and replace it).

## This round: real alerts, real AI, full team + photo management

**Run this first** — a new incremental migration (your first one is already
applied, so use this smaller one, not the full `0001_init.sql` again):
```
supabase/migrations/0002_team_members.sql
```
Paste its contents into the Supabase SQL Editor and run it.

**New Edge Function to deploy:**
```bash
supabase functions deploy ai-assistant --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
```
`--no-verify-jwt` is required here specifically — unlike the other three
functions, this one is called by anonymous website visitors (no login),
so it can't require an auth token.

**What's now real:**
- **Notification Preferences** (Settings) actually saves to the database
  and is what `inquiry-alerts` reads — previously this form didn't save
  anywhere.
- **AI Assistant widget** now calls Claude (via the new `ai-assistant`
  function) instead of canned keyword-matched replies. Needs an
  Anthropic API key (get one at console.anthropic.com).
- **Team members** (About page) are fully CRUD-managed from a new "Team"
  section in the admin sidebar — add, edit, delete, upload/replace/remove
  each person's photo. About page fetches and renders them live.
- **All 20 site photo slots** are now uploadable from Admin → Site
  Content → Site Images: the 3 hero photos, About Mission photo,
  Commitment photo, all 12 "What We Supply" category thumbnails
  (4 per category), and all 3 "Trusted By Professionals" photos.

## Contact form now actually saves submissions (important fix)
Previously the Contact page form was front-end only — it never reached
the database, which meant Reply-to-Inquiry and the alert function had
nothing to work with. It now inserts real rows into `inquiries` on
submit, with a proper success/error message and graceful failure if no
backend is connected yet (rather than silently pretending to work).

## Final homepage redesign (this pass)
- **"What We Supply"**: replaced the large icon-block panels with smaller,
  captioned photo thumbnails (2x2 grid — Stethoscope/Oximeter/BP Monitor/
  Thermometer style) plus a dark "View All [Category] Devices" button,
  matching the reference layout. No more oversized placeholders or text
  crowding the panel.
- **"Trusted By Professionals"**: rebuilt to a white-background photo +
  caption + trigger-list layout (was a dark stats/testimonial section) —
  matches the reference exactly.
- **"Our Commitment" is now a click-to-expand accordion**: click Certified
  Quality, Reliable Logistics, or Expert Support — only the clicked one
  expands with its detail text and lime highlight; the other two collapse
  to just icon + title. Defaults to Certified Quality open.
- Removed the 3 single-photo upload slots for "What We Supply" categories
  from Admin → Site Content, since that section now uses 4 small captioned
  thumbnails per category rather than one big photo — a single upload
  doesn't map cleanly onto 4 slots. Hero (3 photos), About Mission photo,
  and Commitment photo uploads are unaffected.
- Full regression re-run after every change: 0 JS errors, 0 layout
  overflow, at both 1440px and 390px, across every page.

## Working on updates after deployment

Two very different kinds of "update," handled two very different ways:

**1. Content updates (text, photos) — no code needed**
Once the Supabase backend is connected (see the walkthrough above), you
or the client log into `admin.html` and use:
- **Site Content** → edit any page's Hero, About's Mission/Story, Footer,
  or upload real photos — changes go live immediately, no redeploy.
- **Products** → add/edit/publish/delete products, with photo upload.
- **Inquiries** → reply to customer messages directly.

This covers the vast majority of day-to-day changes a client will want.

**2. Design/code updates — need the source files**
For anything structural (new sections, layout changes, new pages,
styling), you're editing the actual HTML/CSS/JS files. Workflow:

1. Make your edits to the `.html`/`.css`/`.js` files locally
2. If you added any new Tailwind utility classes, recompile the CSS:
   ```bash
   npm install -D tailwindcss@3.4.1   # first time only
   npx tailwindcss -i ./tailwind-input.css -o ./tailwind.css --minify
   ```
   (Skip this step if you only changed `style.css` directly — that file
   needs no build step.)
3. Test locally by opening `index.html` in a browser
4. Redeploy:
   - **Netlify drag-and-drop**: just drag the updated folder onto
     app.netlify.com/drop again
   - **Git-connected hosting** (recommended once this is a real
     production site): push to your repo, host auto-deploys. Ask me to
     set this up if you want auto-deploy on every code change instead
     of manual drag-and-drop each time.

**A note on scale**: as the client relationship grows, moving to a
git-based workflow (GitHub + Netlify/Vercel auto-deploy) will save you
real time over manually re-uploading a folder — happy to set that up
whenever you're ready.

## Admin: responding to queries & editing site content
Two new capabilities, both backed by the Supabase functions/tables in
`supabase/`:
- **Reply to Inquiry** — in Admin → Inquiries, each row has a Reply button
  that opens a modal, composes a message, and sends it to the customer's
  email via the `send-reply` Edge Function (Resend). Marks the inquiry
  Responded automatically.
- **Site Content** — a "Site Content" section in the admin sidebar with:
  - **Page Hero editor** — one dropdown selects which page (Home, About,
    Industries, Products, Case Studies, Resources, Contact), and the same
    3 fields (eyebrow badge, headline, subtext) edit that page's hero.
    All 7 pages' heroes are live-editable through this one form.
  - **About — Mission & Vision** and **About — Our Story** — the two main
    prose blocks on the About page, each with their own form.
  - **Footer** — blurb, address, phone, shown on every page.
  All of these write to a `site_content` table and the public pages fetch
  + apply them on load automatically — no redeploy needed. Tested against
  the fallback path (static content shows correctly with no backend
  connected); the live read/write needs the Supabase project set up per
  the steps below.
  - **What's not covered yet**: the repeating card grids — specializations,
    values, team members, industries list, FAQs, product cards. These
    aren't simple text fields (they involve icons, counts, arrays of
    items), so wiring them up is a bigger, more specific job each. The
    exact same pattern (id on the element → form field → `site_content`
    row) extends to any of them; it's a backlog of individual additions
    rather than a single remaining task.

## Deployment (so your client can see progress today)
This is a static site — the fastest way to get a shareable link:

1. Go to https://app.netlify.com/drop
2. Drag the whole `nebro-site` folder onto the page
3. Netlify gives you a live URL in seconds (e.g. `random-name.netlify.app`)
4. Share that link with your client — every time you want to update it,
   drag the folder again (or connect it to a GitHub repo for auto-deploy)

Alternatives: Vercel (similar drag-and-drop via their dashboard), GitHub
Pages (free, needs a GitHub repo), or your own hosting via cPanel/FTP.
Once the client approves, point their real domain at whichever host you pick.

## Phase 2 — the real backend
These need actual server infrastructure, not just files:
- **Auth + roles (Developer/Super Admin/Staff):** Supabase Auth + Row
  Level Security is the fastest realistic path — free tier is enough for this.
- **Email alerts for new/unanswered inquiries:** a scheduled function
  (Supabase Edge Function or a small Node cron job) + Resend or SendGrid
  for sending. The "remind me after N days" logic lives in that job.
- **WhatsApp Business API** (for automated replies, not just the wa.me
  button already in place): requires Meta Business verification — slower
  to set up than everything else here, budget extra time for it.
- **Visitor analytics with location:** don't build this custom — use
  Plausible or Google Analytics 4, both handle it properly (and more
  responsibly, with privacy compliance built in) in an afternoon.
- **Real AI assistant:** swap the canned-response widget for a real
  Claude/OpenAI API call from a small backend function (never call the
  AI API directly from the browser — that exposes your API key).

None of this needs to happen at once — it's a natural "v2" once the
client signs off on the design in front of them.
