import { useState } from "react";
import * as store from "../lib/storage";
import { downloadReportExcel } from "../lib/exportExcel";
import { useAuth } from "../context/AuthContext";
import { LogoutIcon, PhoneIcon, DownloadIcon } from "../components/Icons";

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function startOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function Settings() {
  const { signOut } = useAuth();
  const business = store.getBusiness();

  const [from, setFrom] = useState(startOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  function applyPreset(preset) {
    const today = todayISO();
    if (preset === "month") {
      setFrom(startOfMonthISO());
      setTo(today);
    } else if (preset === "30days") {
      setFrom(daysAgoISO(30));
      setTo(today);
    } else if (preset === "90days") {
      setFrom(daysAgoISO(90));
      setTo(today);
    } else if (preset === "all") {
      setFrom("");
      setTo("");
    }
  }

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      const data = await store.getReport({ from: from || undefined, to: to || undefined });
      const totalRows = data.parcels.length + data.bills.length + data.dealerBills.length;
      if (totalRows === 0) {
        setError("No data found in this date range.");
        return;
      }
      await downloadReportExcel(data, { from, to });
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-ink-50 pb-28">
      <header className="bg-white px-5 pb-4 pt-6 shadow-card">
        <h1 className="text-xl font-bold text-ink-900">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">
          Business details that appear on every invoice
        </p>
      </header>

      <main className="px-5 pt-4">
        <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-lg font-bold text-white">
              {business.logoInitial}
            </div>
            <div>
              <p className="text-[15px] font-bold text-ink-900">
                {business.name}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-ink-500">
                <PhoneIcon width={12} height={12} /> {business.phone}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-600">{business.address}</p>

          <div className="mt-4 rounded-xl bg-ink-50 px-3.5 py-3 text-xs text-ink-500">
            This is fixed at the code level. To change it, edit{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-ink-700">
              src/config/business.js
            </code>{" "}
            and rebuild the app.
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
          <p className="text-sm font-semibold text-ink-700">Export Data (Excel)</p>
          <p className="mt-1 text-sm text-ink-500">
            Download parcels, customer bills, and dealer bills for a date
            range — one clear spreadsheet showing which phone went where and
            when, for whenever you need to trace a problem.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-700">
                From
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-700">
                To
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { key: "month", label: "This Month" },
              { key: "30days", label: "Last 30 Days" },
              { key: "90days", label: "Last 90 Days" },
              { key: "all", label: "All Time" },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className="rounded-full bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-600 active:scale-95"
              >
                {p.label}
              </button>
            ))}
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            onClick={handleExport}
            disabled={exporting}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-base font-semibold text-white shadow-card active:scale-[0.98] disabled:opacity-60"
          >
            <DownloadIcon width={18} height={18} />
            {exporting ? "Preparing…" : "Download Excel Report"}
          </button>

          <p className="mt-3 text-xs text-ink-400">
            The file has separate sheets: Summary, Parcels, Customer Bills,
            and Dealer Bills.
          </p>
        </section>

        <section className="mt-4 rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
          <p className="text-sm font-semibold text-ink-700">Data storage</p>
          <p className="mt-1 text-sm text-ink-500">
            Customers, bills, parcels, and dealer bills are stored in
            MongoDB via the API in{" "}
            <code className="rounded bg-ink-50 px-1.5 py-0.5 font-mono text-ink-700">
              server/
            </code>{" "}
            (Express) and{" "}
            <code className="rounded bg-ink-50 px-1.5 py-0.5 font-mono text-ink-700">
              api/
            </code>{" "}
            (Vercel serverless functions) — every screen talks to them
            through{" "}
            <code className="rounded bg-ink-50 px-1.5 py-0.5 font-mono text-ink-700">
              src/lib/api.js
            </code>
            . Parcel photos are stored in Vercel Blob.
          </p>
        </section>

        <button
          onClick={signOut}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 text-base font-semibold text-red-600 active:scale-[0.98]"
        >
          <LogoutIcon width={18} height={18} /> Log Out
        </button>
      </main>
    </div>
  );
}
