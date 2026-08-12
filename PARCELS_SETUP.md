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
| Open WhatsApp, find the customer's chat, open camera, take photo, type a caption by hand, send | Open the app → **Parcels tab** → tap **Photo** → take photo → pick customer from dropdown → type note → **Save** → tap **Share to WhatsApp** |
| No record of what was sent to whom | Every parcel photo is saved with an auto D-number (D1, D2, D3…), the customer, and the note — permanently, searchable later |
| Manually type every phone's details into the invoice | Open **Bills → New Bill**, use the **"Add from Parcels"** dropdown to pull in already-photographed phones — D-number and note autofill, you just add price |

### Parcels tab

- **Photo button**: opens the capture sheet — take/choose a photo (compressed
  automatically), pick the customer, type the note (e.g. "iPhone 17 256"),
  Save. You'll immediately get a **D-number** and a **Share to WhatsApp**
  button — tap it right away for the most reliable share (iOS is picky about
  sharing only working right after a tap, so the button is a deliberate
  separate step, not automatic).
- Parcels list is split into **Pending** and **Billed** sections.
- Each card has its own **Share** and **Delete** buttons.
- **Select mode** (top-right "Select" button): tap multiple parcel photos,
  then **Share Selected** sends all of them together with one combined
  caption listing each D-number/customer/note. If a browser doesn't support
  multi-image sharing (some Android browsers), it falls back to sharing them
  one at a time.

### Bills tab (Create Bill)

- New **"Add from Parcels"** dropdown inside the Items section. Picking a
  parcel adds an item row with the D-number and note already filled in —
  you just type the price (and adjust quantity if it's more than 1).
- Once a parcel is used in a saved bill, it **disappears from this dropdown**
  automatically (moves to "Billed" in the Parcels tab).
- **"Show already-billed photos too (for dealer bills)"** checkbox: your
  specific case of billing the dealer separately after already billing the
  customer. Check it, and every parcel — pending or already billed — becomes
  selectable again, so you can reuse the same photo in a second bill.
- You can still add fully manual items (no parcel) with **"+ Add Item"** —
  nothing about the old flow was removed, this is purely additive.

## 3. Data model notes (for future reference)

- `Parcel`: `dNumber` (unique, auto), `customerId`/`customerName`/`customerPhone`,
  `note`, `imageUrl` (Vercel Blob URL), `billedBillIds` (array — a parcel can
  belong to more than one bill, which is exactly what makes the dealer-reuse
  case work).
- `Bill.items[].parcelId`: optional link back to the parcel a line item came
  from. When a bill is created, any items with a `parcelId` cause that
  parcel's `billedBillIds` to get the new bill's ID appended.

## 4. Local development

Both the Express server (`server/`) and the Vercel serverless functions
(`api/`) implement the same Parcels endpoints, so local dev (`npm run
dev:all`) and production (Vercel) behave identically. Make sure
`BLOB_READ_WRITE_TOKEN` is set in your local `.env` too, or photo uploads
will fail locally even though everything else works.

## 5. Known limitations / honest caveats

- **Multi-image share** depends on the browser supporting `navigator.share`
  with multiple files. iOS Safari (17+) and recent Chrome/Android generally
  do; older browsers or in-app browsers (WhatsApp's own built-in browser,
  Instagram's, etc.) often don't — the app falls back to sharing one at a
  time or shows a message if sharing isn't available at all.
- **Photo compression** happens in the browser before upload — this keeps
  things fast and cheap, but means very low-light or detail-heavy photos
  (e.g. trying to photograph a tiny serial number) may lose some sharpness.
  If you ever need full-resolution originals, that's a deliberate tradeoff
  this setup makes for storage/speed — let me know if you want an
  "uncompressed" option added later.
- **Vercel Blob free tier** is on the *account*, not per-project — if you
  run other projects with Blob storage on the same Vercel account, they
  share the 1GB/10GB pool.
