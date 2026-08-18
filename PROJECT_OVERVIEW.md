# Invoice Manager — Project Overview

A mobile-first web app built for a phone-reselling side business run out of
Ahmedabad, India. This document exists so that anyone (including a future
version of you, or another developer, or another AI) can understand not
just *what* this app does, but *why* it exists in this exact shape.

---

## 1. The business this app runs

This is a family-involved phone-reselling operation. The core workflow,
before this app existed, looked like this:

1. A parcel (a phone) physically arrives.
2. The owner opens WhatsApp, finds the specific chat for whoever the phone
   is ultimately for (e.g. a customer named "Irfan"), opens the camera from
   inside that chat, photographs the parcel, types a caption by hand
   (phone model + variant), and sends it — purely as a notification/proof
   step.
3. The parcel then goes to a **dealer** — a separate party involved in the
   supply/logistics side of the business. The owner would manually type up
   a WhatsApp message like:
   ```
   A:352
   iPhone 17 : 2 Piece
   iPhone 16 : 1 Piece
   ```
   to tell the dealer exactly what was handed over, under a batch number
   the owner made up on the spot (an "A-series" number).
4. Once the dealer pays for that batch, the owner would go create a
   priced bill for the dealer — again manually.
5. Separately, once payment is received from the end customer, the owner
   would open an invoice generator and manually type in every field to
   produce a customer-facing bill, then send that as a PDF/image.

**The core problem this app solves**: every step above was manual re-entry
of the same information (which phone, which customer, which model), with
no record connecting the steps together. If a dispute came up later
("did I actually send this phone to the dealer? did I bill the customer
for it? what did I charge?"), there was no single place to check — it was
scattered across WhatsApp chat history and memory.

Everything in this app exists to remove a specific piece of that manual
re-typing, while keeping every record traceable back to the others.

---

## 2. The five modules, and why each one exists

### 2.1 Parcels (the photo-capture stage)

**What it does**: Take/upload a photo of a parcel, pick which customer
it's ultimately for from a dropdown, add a note (e.g. "iPhone 17 256"),
save. The app auto-generates a **D-number** (D1, D2, D3, ...) - a
permanent, never-reused identifier for that specific physical phone. A
dedicated Share button sends the photo + a caption (D-number, customer,
note) straight to WhatsApp.

**Why it exists**: this replaces step 2 of the old workflow - opening the
right WhatsApp chat, taking the photo there, typing the caption by hand -
with a form that also *keeps a permanent record*, which the old workflow
never had. The D-number is the thread that ties everything else together.

**Why the D-number never reuses a number, even after deleting everything**:
early testing revealed that if numbering were based on "the highest number
currently in the database," deleting test data would reset it, and a new
D1 could collide with a real, already-referenced D1 from history. Fixed
with a persistent atomic counter (`Counter` model) that only ever
increments - bootstrapped once from whatever data already existed, so it
picks up seamlessly rather than colliding.

**Why photos are compressed client-side before upload**: parcel photos
don't need to be full camera resolution to serve their purpose (proof of
condition + identifying the model). Compressing to ~1280px/JPEG ~80%
quality before upload keeps files in the 100-400KB range - fast on mobile
data, and keeps hosting costs on the free tier for a very long time (see
Section 4 below).

**Why photos are grouped by customer, collapsed, instead of a flat list**:
with dozens or hundreds of parcels accumulating, a flat scrolling list
becomes unusable for "let me see everything for this one person." An
accordion grouped by customer, collapsed by default, keeps the screen scannable.

**Why there are two separate status tags (not just "Billed" / "Pending")**:
a single phone can independently be (a) billed to the end customer and
(b) sent to a dealer - these are two separate accounting relationships for
the same physical object, not stages of one pipeline. So a parcel photo
can show a **green tag** (real customer bill number, e.g. `INV-101`), an
**indigo tag** (dealer bundle number, e.g. `A:352`), both, or neither.
Conflating them into one status would have hidden real information.

### 2.2 Bills (customer-facing invoices)

**What it does**: Pick a customer, add line items - either fully manual,
or pulled straight from an already-photographed parcel via an "Add from
Parcels" dropdown (which auto-fills the D-number and model, leaving just
the price to type). Generates a professional invoice, downloadable as JPG
or PDF, shareable directly to WhatsApp.

**Why "Add from Parcels" exists**: the whole point of tracking D-numbers
upstream is that by the time you're billing the customer, you shouldn't
have to re-type the phone model again - it's already known.

**Why the bill number is fully free-text, not auto-generated**: the owner
already had a personal numbering convention (their own "A-series") before
this app existed. Rather than impose a different scheme, the app just
gets out of the way and lets the number be typed exactly as the business
already uses it.

**Why the bill number renders bold, large, and red on the invoice**: an
early requirement - it's the single most important thing to find at a
glance when flipping through invoices, so it needed to visually dominate
the layout rather than sit as one line among many.

**Why a parcel can be reused across more than one customer bill**
(`billedBillIds` is an array, not a single flag): covers edge cases like
re-billing or correcting a bill without losing the original link.

### 2.3 Dealer Bills (the dealer side of the business)

**What it does**: from Parcels, multi-select several photos, assign them
an A-number + description, and the app generates a **packing manifest** -
just D-number and phone model per row, no prices, with a "X Pieces Total"
footer - instantly shareable to the dealer as proof of what went out.
Later, once the dealer agrees on pricing, open that same bundle, tap
**Add Prices**, and it becomes a fully priced invoice, shareable the same
way.

**Why this is a two-stage process (packed -> priced) instead of one form**:
this mirrors the real business timing exactly - the owner knows *what*
went to the dealer immediately, but not *what it's worth* until the
dealer responds. Forcing a price at creation time would mean typing in a
placeholder and editing it later anyway; splitting the stages avoids that.

**Why a parcel can only be in *one* dealer bundle at a time**
(`dealerBillId` is a single reference, not an array) - unlike customer
bills, which allow reuse: a dealer bundle represents a specific physical
handoff event. The same phone can't be handed off to the dealer twice
simultaneously the way it can legitimately appear on two different
customer-facing documents.

**Why bundles are editable after creation (Edit Items, separate from Edit
Prices)**: a very concrete real scenario drove this - "I made a 3-piece
bundle, a 4th parcel just arrived, I want it in the *same* bundle instead
of starting a new one." The edit screen shows every parcel as a checklist
(already-included ones pre-checked); ticking a new one adds it, unticking
one removes it and frees that parcel up for a different bundle. Adding a
new item resets the bundle to "packed" (since the new item needs its own
price), but removing an item preserves whatever prices were already
entered for the rest - no wasted re-entry.

**Why Edit Items lives in the outer Dealer Bills list, not nested inside
the bundle's detail page**: originally it was a button inside the detail
view, but the request was specifically to surface it at the list level so
it's one tap away, not two.

### 2.4 Customer Ledger

**What it does**: tap any customer to see their complete history in one
screen - total bills, total spent, total parcels, pending amount owed, a
list of every bill, and a photo grid of every parcel tied to them.

**Why it exists**: before this, understanding "everything about this one
customer" meant separately searching the Bills tab and the Parcels tab
and mentally cross-referencing. This collapses that into a single view -
explicitly built as the "when a problem comes up, where do I look" screen
for one specific person.

### 2.5 Home (Dashboard) - Pending Payments

**What it does**: on the main landing screen, alongside the usual list of
bills (grouped by month), there's a **Pending Payments** section grouped
by customer. It surfaces every parcel where the *dealer* has already set
a price (so the cost/value is known) but no *customer* bill has been
created yet - with an aggregate amount per customer. Once a real
customer bill is created for those pieces, they automatically disappear
from this list.

**Why this exists**: this is the gap between "I know what this phone is
worth" and "I've actually invoiced the customer for it" - exactly the
kind of thing that's easy to lose track of when it's not written down
anywhere. The dealer's price acts as a reliable stand-in for expected
revenue before the real invoice exists. It's meant to answer, at a
glance, "who do I still need to bill, and roughly how much."

### 2.6 Excel Export (Settings)

**What it does**: pick a date range, download a `.xlsx` file with four
sheets - Summary, Parcels (every phone: where it came from, where it
went), Customer Bills (one row per line item), Dealer Bills (one row per
piece, with packed/priced status).

**Why it exists**: a direct answer to "when a problem arises, I need one
file I can actually dig through" - Excel, not a screen in the app, because
disputes and reconciliation happen in spreadsheets, sortable and
filterable, not in a scrolling mobile UI.

**Why it's lazy-loaded**: the Excel-generation library is large (~140KB
gzipped). Loading it eagerly would have slowed down every single page
load for a feature used maybe a few times a month. It only downloads when
the Export button is actually tapped.

### 2.7 Dark Mode

**Why it exists**: requested directly, no deeper business reason - but
worth noting the one deliberate exception: **the invoice/manifest
templates themselves never go dark**, even with dark mode on. A shared PDF
or image needs to look identical and professional to whoever receives it,
regardless of what theme the sender's phone happens to be in.

---

## 3. Architecture, and why it's built this way

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + Tailwind CSS | Fast mobile-first iteration, no build complexity |
| Routing | React Router, client-side | Single page app, feels native on a phone home-screen |
| Backend | Express (local dev) **and** Vercel serverless functions (production) - same logic, two entry points | Vercel doesn't run persistent servers, so the deployed app needs serverless handlers; but local development is faster and easier to debug against a normal long-running Express process. Both call into the same Mongoose models. |
| Database | MongoDB (Atlas free tier in production) | Flexible schema suited to a fast-evolving small app; generous enough free tier for this scale |
| Image storage | Vercel Blob | Purpose-built for user-uploaded files; GitHub isn't meant for this (repos aren't a CDN) and MongoDB's free tier would fill up fast storing photos as documents |
| PDF/JPG generation | html2canvas + jsPDF, client-side | No server-side rendering infrastructure needed; renders the exact same styled component the user already sees on screen |
| Excel generation | `xlsx` (SheetJS), client-side, lazy-loaded | No backend file-generation/storage needed; the browser builds and downloads the file directly |

**Every screen talks to the backend through one file**
(`src/lib/api.js`, re-exported via `src/lib/storage.js`). This was a
deliberate choice from very early on: if the backend is ever replaced -
different database, different hosting - only that one file's internals
need to change; every page's code stays identical.

**Login is intentionally NOT stored in the database.** It's a static
admin/admin credential check, persisted only in the browser's
localStorage. This is a single-person/family tool, not a multi-tenant
SaaS product - there was no reason to build real user accounts for this
scale, and it keeps the whole login flow trivially simple.

---

## 4. Data model summary

- **Customer** - name, phone, address.
- **Parcel** - the photo-capture record. `dNumber` (permanent, never
  reused), customer info, note, image URL, `billedBillIds` (array - can
  belong to multiple customer bills), `dealerBillId` (single - exclusive
  to one dealer bundle), `dealerPrice` (denormalized once a dealer bundle
  prices it, powering the Pending Payments feature without an expensive
  join on every page load).
- **Bill** - customer-facing invoice. Free-text `billNo`, customer info,
  line items (each optionally linked back to the parcel it came from via
  `parcelId`), computed total, and `monthKey`/`monthLabel` so bills can be
  grouped by month directly via database aggregation.
- **DealerBill** - the dealer bundle. `billNo` (A-number), description,
  items (each with a denormalized D-number/model so the bundle still
  reads correctly even if that parcel is later deleted), `status`
  (`"packed"` or `"priced"`), computed totals.
- **Counter** - a tiny generic `{key, seq}` collection used solely to hand
  out D-numbers atomically and permanently.

---

## 5. Deployment

Full step-by-step setup lives in **`README.md`** (MongoDB Atlas + Vercel)
and **`PARCELS_SETUP.md`** (Vercel Blob image storage, and the complete
Parcels/Dealer workflow walkthrough). Short version: MongoDB Atlas for the
database, Vercel for hosting (static frontend + `/api` serverless
functions on the same domain, so no CORS configuration is needed), Vercel
Blob for photo storage - all free-tier services suited to this scale.

---

## 6. Known limitations (stated honestly, not buried)

- **No partial-payment tracking on customer bills.** A bill is either
  created (implicitly "billed") or it doesn't exist - there's no "customer
  paid part of the total, owes the rest" state on an actual bill. The
  "Pending Payments" feature is a different thing: it tracks parcels that
  haven't been invoiced *at all* yet, not partial payment on invoices that
  already exist.
- **No cost-price/profit tracking.** The app tracks what a dealer charged
  (via dealer bills) and what a customer was charged (via customer bills)
  as two independent numbers - it doesn't automatically compute margin
  between them.
- **Multi-image WhatsApp share** depends on browser support for
  `navigator.share` with multiple files - works on modern Safari/Chrome,
  may fall back to one-at-a-time sharing on older or in-app browsers.
- **Photo compression is one-way** - original full-resolution photos
  aren't kept once compressed at upload time.
- **Single shared login** - no per-person accounts, since this is a
  small, trusted, family-run operation, not a multi-tenant product.

---

## 7. Ideas considered but not yet built

These came up in discussion and are reasonable next steps, roughly in
order of likely business value:

1. **Cost price + profit tracking** - capture what the dealer charges,
   auto-compute margin per sale.
2. **Partial payment / dues tracking on actual bills** - a proper "owes
   X of Y" state, distinct from the current Pending Payments feature.
3. **IMEI/serial number field** on parcels - useful for warranty and
   dispute resolution.
4. **Return/cancel a bill** without deleting its record.
5. **WhatsApp payment reminders** - pre-filled message, one tap.
6. **Simple analytics** - monthly revenue trend, best-selling models.
7. **Multi-staff logins**, since family members are involved.
8. **PWA install** ("Add to Home Screen" with a real app icon).
9. **GST-compliant invoice fields**, if ever required.

---

## 8. A note on how this document should be maintained

This file is meant to explain *reasoning*, not just list features - when
something new gets added, the useful addition to this doc isn't just "what
it does" but "what specific problem in the business made this worth
building." That's the part that gets lost fastest if it isn't written
down.
