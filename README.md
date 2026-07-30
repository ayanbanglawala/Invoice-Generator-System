# Invoice Manager

A mobile-first React + Vite + Tailwind app to create branded invoices, backed by a small Express + MongoDB API, with export/share to PDF and JPG.

## Setup

1. Copy the env file and fill in your MongoDB connection string:
   ```bash
   cp .env.example .env
   ```
   `MONGODB_URI` can point at a local `mongod` (`mongodb://127.0.0.1:27017/invoice_manager`) or a MongoDB Atlas cluster.

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the app (starts the Vite dev server **and** the API server together):
   ```bash
   npm run dev:all
   ```
   Or run them separately in two terminals: `npm run dev` (frontend) and `npm run server` (API).

The frontend talks to the API at `VITE_API_URL` (default `http://localhost:5000/api`).

## Login

- User ID: `admin`
- Password: `admin`

This stays local to the browser (localStorage) — deliberately not in the database. Stays logged in until you tap "Log Out".

## Edit your business details

Open `src/config/business.js` and change the name, address, phone, and logo initial. This appears on every invoice automatically — no UI or database involved.

## Data storage — now MongoDB

Customers and bills are stored in MongoDB via the Express API in `server/`:

- `server/models/Customer.js` — name, phone, address
- `server/models/Bill.js` — billNo, customer info, line items, computed total, and `monthKey` / `monthLabel` (e.g. `2026-01` / `January 2026`) so bills can be grouped by month directly in the database via aggregation
- `server/routes/customers.js`, `server/routes/bills.js` — REST endpoints (`GET/POST /api/customers`, `GET/POST /api/bills`, `GET /api/bills/grouped`, `DELETE` for both)

The frontend never touches localStorage for this data anymore — every screen calls `src/lib/api.js` (re-exported through `src/lib/storage.js` so imports didn't need to change). If you want to swap the backend later, `server/` is a self-contained Express app you can redeploy anywhere.

## Creating a bill

1. Tap the **+** button (bottom nav).
2. Pick a customer from the dropdown, or add a new one inline — saved straight to MongoDB.
3. Enter your own **Bill / Invoice Number** (e.g. `INV-101`) — nothing is auto-generated, you control the numbering.
4. Add items — a custom **SR** label you type yourself (e.g. `D1`, `D2`), Model Name, Quantity, Bill Price. Per-item and grand totals calculate automatically.
5. Save — the bill is written to MongoDB with its month derived from the date automatically.

## Viewing bills — grouped by month

The Bills tab groups every invoice under collapsible month headers (**January 2026**, **July 2026**, etc.), most recent month first, with a running count and total per month. Tap a month to expand it and see its bills; tap a bill to open it.

## Bill number visibility

The Bill Number is shown **bold, larger, and in red** on the invoice itself and in the bill list, so it stands out at a glance.

## Exporting

On a bill's page: **Download JPG**, **Download PDF**, or **Share** (uses the native mobile share sheet — WhatsApp/Email/etc. — sharing a PDF; falls back to download if sharing isn't supported).

## Deploying on Vercel with MongoDB

The `api/` folder contains Vercel serverless functions (separate from the
`server/` Express app, which is only for local dev / non-Vercel hosting).
Deploying gives you one Vercel project serving both the React app and the
API on the same domain — no CORS setup needed.

### 1. Set up MongoDB Atlas (free tier works)

1. Create an account at mongodb.com/cloud/atlas and create a free (M0) cluster.
2. Under **Database Access**, add a database user with a username/password.
3. Under **Network Access**, add `0.0.0.0/0` (allow access from anywhere) —
   Vercel's serverless functions run from rotating IPs, so you can't
   whitelist a fixed one.
4. Click **Connect → Drivers**, copy the connection string. It looks like:
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/invoice_manager?retryWrites=true&w=majority`
   (add `/invoice_manager` before the `?` so it targets that database name).

### 2. Push this project to GitHub

Vercel deploys from a Git repo:
```bash
git init
git add .
git commit -m "Invoice manager"
git branch -M main
git remote add origin https://github.com/<you>/invoice-app.git
git push -u origin main
```

### 3. Import into Vercel

1. Go to vercel.com → **Add New → Project** → import your GitHub repo.
2. Vercel auto-detects the Vite framework — leave build settings as default
   (Build Command: `vite build`, Output Directory: `dist`).
3. Before deploying, open **Environment Variables** and add:
   - `MONGODB_URI` = the Atlas connection string from step 1
   - Do **not** set `VITE_API_URL` — leave it unset so the frontend defaults
     to `/api` (same domain as the serverless functions).
4. Click **Deploy**.

### 4. Verify

Once deployed, open `https://<your-project>.vercel.app`. Log in
(`admin`/`admin`), add a customer, create a bill — it should appear
instantly in MongoDB Atlas under the `invoice_manager` database
(`customers` and `bills` collections).

If bills don't load, check **Vercel → your project → Deployments → Functions
logs** for a MongoDB connection error (usually a wrong password, missing
`0.0.0.0/0` network rule, or a typo in `MONGODB_URI`).

### Redeploying after changes

Any `git push` to the connected branch triggers a new Vercel deployment
automatically.

## Tech

- Vite + React + React Router, Tailwind CSS
- Express + Mongoose (MongoDB) API in `server/`
- html2canvas + jsPDF for PDF/JPG generation

