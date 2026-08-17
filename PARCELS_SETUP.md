# Parcels Module — Setup & Guide

This adds a second module, **Parcels**, that sits *before* the Invoice tab in
your workflow: photo → tag customer → note → auto D-number → share to
WhatsApp → later, pull it into a real bill.

## 1. One-time setup: Vercel Blob (image storage)

Parcel photos are stored in **Vercel Blob**, not in MongoDB and not in
GitHub. Here's why, briefly:

- **MongoDB**: technically possible to store photos as base64 inside a
  document, but it bloats your database fast, is slow to query/list, and
  MongoDB Atlas's free tier only gives you 512MB total — that fills up in
  days with photos.
- **GitHub**: not built for user-uploaded content. Repos aren't meant to be
  an image CDN — you'd hit abuse detection and it's just the wrong tool.
- **Vercel Blob**: built exactly for this. Free (Hobby) tier: **1GB storage,
  10GB transfer/month** (verified against Vercel's pricing page as of a few
  weeks before this was written — check vercel.com/pricing if it's been a
  while, these numbers do shift). Photos are compressed client-side before
  upload (resized to ~1280px, JPEG ~80% quality), so each one is typically
  100–400KB — that's **2,500–10,000 photos** before you'd hit the free
  storage cap. For a phone-reselling side business, that's a long runway.

### Enable it

1. Go to your Vercel project → **Storage** tab → **Create Database** → choose
   **Blob**.
2. Give it a name (anything, e.g. `parcel-photos`) → Create.
3. Vercel automatically adds a `BLOB_READ_WRITE_TOKEN` environment variable
   to your project — you don't need to copy/paste anything for production.
4. **For local development**, go to Storage → your Blob store → `.env.local`
   tab → copy the `BLOB_READ_WRITE_TOKEN` value into your local `.env` file
   (see `.env.example`).
5. Redeploy (or push any commit) so the new env var takes effect.

That's the entire setup — no other account, no API keys to generate
manually.

## 2. How the workflow maps to the app

**Old workflow → New workflow:**

| Before | Now |
|---|---|
| Open WhatsApp, find the customer's chat, open camera, take photo, type a caption by hand, send | Open the app → **Parcels tab** → tap **Photo** → take/upload photo → pick customer from dropdown → type note → **Save** → tap **Share to WhatsApp** |
| No record of what was sent to whom | Every parcel photo is saved with an auto D-number (D1, D2, D3…), the customer, and the note — permanently, searchable later |
| Manually type every phone's details into the invoice | Open **Bills → New Bill**, use the **"Add from Parcels"** dropdown to pull in already-photographed phones — D-number and note autofill, you just add price |
| Manually type up a WhatsApp message listing pieces for the dealer, then separately work out dealer pricing from memory later | Select the parcel photos in the **Parcels tab**, tap **Send to Dealer**, give it an A-number — an auto-generated packing list PDF/image is ready to share immediately. When payment time comes, open it from the **Dealer tab** and fill in prices to get a priced invoice |

### Parcels tab

- **Photo button**: opens the capture sheet. Two options — **Take Photo**
  (camera) or **Upload Image** (existing photo from your gallery, for parcels
  you're just backfilling into the system). Pick customer, type the note
  (e.g. "iPhone 17 256"), Save. You'll immediately get a **D-number** and a
  **Share to WhatsApp** button — tap it right away for the most reliable
  share (iOS is picky about sharing only working right after a tap, so it's
  a deliberate separate step, not automatic).
- Parcels are **grouped by customer**, collapsed by default — tap a
  customer's name to expand and see just their photos. A small amber badge
  shows how many of that customer's parcels are still pending.
- Each photo card shows up to two tags in its corner:
  - **Green** — the actual customer bill number(s) it's been billed under
    (e.g. `INV-101`). Only appears once it's actually in a saved bill.
  - **Indigo** — the dealer bundle A-number (e.g. `A:352`), if it's been
    sent to a dealer. These two tags are independent — a photo can carry
    both, one, or neither.
- **Select mode** (top-right "Select" button): tap multiple photos, then use
  the three buttons at the bottom:
  - **Share** — sends all selected photos together with one combined caption
    (falls back to one-at-a-time on browsers that can't multi-share).
  - **Send to Dealer** — bundles the selection under a new A-number (see
    below). Photos already in another dealer bundle are automatically
    skipped with a warning, since a photo can only belong to one bundle.
  - **Delete** — removes all selected photos permanently, with one
    confirmation for the whole batch.

### Bills tab (Create Bill) — customer invoices, unchanged in spirit

- **"Add from Parcels"** dropdown inside Items. Picking a parcel adds a row
  with the D-number and note pre-filled — you just type the price.
- Once used in a saved customer bill, that parcel disappears from this
  dropdown (its green tag appears in the Parcels tab).
- **"Show already-billed photos too"** checkbox — bypasses that filter, for
  cases where you need to reuse the same photo in a second customer bill.
- Being sent to a dealer (indigo tag) has **no effect** on this dropdown —
  the two tracks are intentionally independent, since the same phone
  legitimately needs both a customer-facing bill and separate dealer
  accounting.

### Dealer tab — new

This is the automation for your manual "A:352 / iPhone 17: 2 Piece / ..."
WhatsApp messages.

**Step 1 — Send to Dealer (packing list stage).**
In Parcels, select the photos physically going out, tap **Send to Dealer**,
enter your bill number (e.g. `A:352`) and an optional description. This
creates a **dealer bundle**: a manifest listing just the D-number and phone
model for each piece, with a **"X Pieces Total"** footer at the bottom — no
prices. You're dropped straight onto its page with Download JPG/PDF/Share
buttons, ready to send to the dealer immediately as proof of what went out.

**Step 2 — the Dealer tab.**
Every bundle you've created lives here as a collapsible row: bill number,
piece count, and a status badge — **"Awaiting Price"** (amber) or
**"Priced"** (green). Tap a row to expand and see its items inline.

**Editing a bundle after the fact.**
Open any dealer bill and you'll see two buttons: **Edit Items** and **Add
Prices** / **Edit Prices**. Edit Items shows every parcel photo with a
checkbox — already-included ones are pre-ticked. Tick a newly-arrived
parcel to add it (3 pieces → 4), untick one to remove it (3 → 2) — the
removed parcel becomes available for a different dealer bundle again.
Save, and the bundle regenerates: if you added anything new, it drops back
to "Awaiting Price" so you can price just the new piece; if you only
removed something, prices you already entered for the rest are kept as-is.

**Step 3 — pricing, once payment time comes.**
Open a bundle (via the Dealer tab or straight from its manifest page) and
tap **Add Prices**. You get one row per piece — D-number, model, and a price
field, same pattern as the customer Create Bill screen. Save, and it
regenerates as a fully priced invoice (same visual template as customer
invoices) with a running total — Download/Share exactly like a normal bill.
You can come back and **Edit Prices** on it later too.

**Exclusivity:** once a photo is in a dealer bundle, it can't be selected
into a *second* dealer bundle — the multi-select list in Parcels simply
won't offer it again. It remains fully available for a customer bill the
whole time, independently.

### Your full workflow, end to end

1. Parcel physically arrives → **Parcels tab** → Photo → tag customer → note
   → Save → **Share to WhatsApp** (notifies the parcel's owner).
2. Select that photo (and others going out together) → **Send to Dealer** →
   give it an A-number + description → share the generated packing list to
   the dealer on WhatsApp (they now know exactly what pieces went out).
3. When the dealer pays you: **Dealer tab** → open that A-number bundle →
   **Add Prices** → fill in what you're billing the dealer for each piece →
   Save → share the priced invoice to the dealer.
4. Once you physically receive payment from the end customer: **Bills tab**
   → New Bill → pick the customer → **Add from Parcels** to pull in the same
   D-numbered items → set price → Save & share — same customer-invoice flow
   as before, unchanged.

## 3. Data model notes (for future reference)

- `Parcel`: `dNumber` (unique, permanently non-reused — see the counter note
  below), `customerId`/`customerName`/`customerPhone`, `note`, `imageUrl`
  (Vercel Blob URL), `billedBillIds` (array — a parcel can belong to more
  than one *customer* bill), `dealerBillId` (single ref — exclusive to one
  dealer bundle at a time).
- `Counter`: a tiny generic collection (`{ key, seq }`) used to hand out
  D-numbers atomically. It's bootstrapped once from whatever the highest
  existing D-number is, then only ever increments — so deleting every
  parcel (including for testing) never causes a number to be reused. If you
  had parcels D1–D22, deleted D10–D22, and created a new one, it becomes
  D23, not D10.
- `Bill.items[].parcelId`: optional link back to the parcel a customer-bill
  line item came from. Creating the bill appends its ID to that parcel's
  `billedBillIds`.
- `DealerBill`: `billNo` (your A-number, free text), `note`, `items[]` (each
  with `parcelId`, denormalized `dNumber`/`name` so the bundle still reads
  correctly even if that parcel is later deleted, `qty`, `price`), `status`
  (`"packed"` until priced, then `"priced"`), `totalPieces`/`totalAmount`
  (auto-computed). Creating one sets `dealerBillId` on every included
  parcel; deleting one clears it back to `null` so those parcels become
  selectable for a new bundle again.

## 4. Local development

Both the Express server (`server/`) and the Vercel serverless functions
(`api/`) implement the same Parcels and Dealer Bill endpoints, so local dev
(`npm run dev:all`) and production (Vercel) behave identically. Make sure
`BLOB_READ_WRITE_TOKEN` is set in your local `.env` too, or photo uploads
will fail locally even though everything else works.

## 5. Excel export (Settings tab)

Settings has an **Export Data** section: pick a date range (or use the
This Month / Last 30 Days / Last 90 Days / All Time shortcuts) and tap
**Download Excel Report**. It pulls from `GET /api/reports` and generates a
`.xlsx` file client-side (via the `xlsx` package, lazy-loaded only when you
actually export, so it doesn't bloat the app's normal load time) with four
sheets:

- **Summary** — totals for the range: parcels received, how many are still
  pending, customer bills created + total revenue, dealer bundles created +
  pieces sent out + revenue from priced bundles.
- **Parcels** — every phone that came in during the range: D-number, date,
  customer, phone number, model/variant, and where it ended up — customer
  bill number(s), dealer bundle number, both, or "Pending" if neither yet.
- **Customer Bills** — one row per line item across every bill in the
  range (bill number, date, customer, D-number, model, qty, price, line
  total, bill total).
- **Dealer Bills** — the same idea for dealer bundles: one row per piece,
  including whether that bundle is still "Awaiting Price" or "Priced".

This is meant to be the single reference for "what happened to this phone,
and when" — everything in one file, sortable/filterable in Excel itself,
for whenever you need to trace back a problem.

## 6. Known limitations / honest caveats

- **Multi-image share** depends on the browser supporting `navigator.share`
  with multiple files. iOS Safari (17+) and recent Chrome/Android generally
  do; older browsers or in-app browsers (WhatsApp's own built-in browser,
  Instagram's, etc.) often don't — the app falls back to sharing one at a
  time or shows a message if sharing isn't available at all.
- **Photo compression** happens in the browser before upload — this keeps
  things fast and cheap, but means very low-light or detail-heavy photos
  (e.g. trying to photograph a tiny serial number) may lose some sharpness.
  If you ever need full-resolution originals, let me know and I can add an
  "uncompressed" option.
- **Dealer bundle quantity**: each line in a dealer bundle is always exactly
  1 piece (one photographed parcel = one physical unit) — there's no
  "combine 2 identical phones into one row with qty 2" option currently. If
  two iPhone 17s went out together, they show as two separate D-number rows
  in the manifest, not one row saying "iPhone 17 × 2". Let me know if you'd
  rather have them auto-grouped by model name in the manifest/invoice.
- **Vercel Blob free tier** is on the *account*, not per-project — if you
  run other projects with Blob storage on the same Vercel account, they
  share the 1GB/10GB pool.
