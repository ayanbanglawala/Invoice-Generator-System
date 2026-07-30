# Invoice Manager

A mobile-first React + Vite + Tailwind app to create branded invoices and export/share them as PDFs.

## Run it

```bash
npm install
npm run dev
```

## Login

- User ID: `admin`
- Password: `admin`

Stays logged in until you tap "Log Out" (session is stored in localStorage, not cookies, so it survives refreshes/app restarts).

## Edit your business details

Open `src/config/business.js` and change the name, address, phone, and logo initial. This appears on every invoice automatically — no UI needed.

## How data is stored right now

Everything (customers + bill history) lives in the browser's localStorage, isolated behind `src/lib/storage.js`. Every page calls functions from that one file (`getBills`, `createBill`, `getCustomers`, `saveCustomer`, etc.) — nothing else touches localStorage directly.

When you're ready to add a real database/backend: rewrite the functions inside `src/lib/storage.js` to call your API instead (e.g. `fetch('/api/bills')`), keep the same function names/shapes, and the rest of the app keeps working unchanged.

## Creating a bill

1. Tap the **+** button (bottom nav).
2. Pick a customer from the dropdown, or add a new one inline.
3. Add items — Model Name, Quantity, Bill Price. Total per item and grand total calculate automatically.
4. Save — an Order ID (e.g. `ORD-0001`) is generated automatically.
5. On the bill screen, tap **Download PDF** or **Share** (uses the native share sheet on phones so you can send straight to WhatsApp/Email/etc.).

## Tech

- Vite + React + React Router
- Tailwind CSS
- html2canvas + jsPDF for PDF generation
