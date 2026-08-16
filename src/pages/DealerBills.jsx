import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as store from "../lib/storage";
import { PackageIcon, ChevronDownIcon, SearchIcon } from "../components/Icons";

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DealerBills() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    store
      .getDealerBills()
      .then((data) => {
        setBills(data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bills;
    return bills.filter(
      (b) =>
        b.billNo?.toLowerCase().includes(q) ||
        b.items?.some((it) => it.name?.toLowerCase().includes(q) || it.dNumber?.toLowerCase().includes(q))
    );
  }, [bills, query]);

  const packedCount = bills.filter((b) => b.status === "packed").length;
  const totalPieces = bills.reduce((s, b) => s + (b.totalPieces || 0), 0);

  return (
    <div className="min-h-dvh bg-ink-50 pb-28">
      <header className="bg-white px-5 pb-5 pt-6 shadow-card">
        <h1 className="text-xl font-bold text-ink-900">Dealer Bills</h1>
        <p className="mt-1 text-sm text-ink-500">
          {bills.length} bundle{bills.length === 1 ? "" : "s"} · {packedCount} awaiting price · {totalPieces} pieces total
        </p>

        <div className="relative mt-4">
          <SearchIcon
            width={18}
            height={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by bill number or model"
            className="h-11 w-full rounded-xl border border-ink-200 bg-white pl-10 pr-4 text-sm text-ink-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </header>

      <main className="px-5 pt-4">
        {error && (
          <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load dealer bills: {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl border border-ink-100 bg-white shadow-card" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
              <PackageIcon width={26} height={26} />
            </div>
            <p className="mt-4 text-[15px] font-semibold text-ink-800">
              {query ? "No matching dealer bills" : "No dealer bills yet"}
            </p>
            <p className="mt-1 max-w-[240px] text-sm text-ink-500">
              {query
                ? "Try a different search term."
                : "Select photos in the Parcels tab and tap \"Send to Dealer\" to create one."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((bill) => {
              const isOpen = openId === bill._id;
              return (
                <section
                  key={bill._id}
                  className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card"
                >
                  <button
                    onClick={() => setOpenId(isOpen ? null : bill._id)}
                    className="flex w-full items-center justify-between px-4 py-3.5"
                  >
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-extrabold text-indigo-600">
                          {bill.billNo}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            bill.status === "priced"
                              ? "bg-green-50 text-green-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {bill.status === "priced" ? "Priced" : "Awaiting Price"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {formatDate(bill.createdAt)} · {bill.totalPieces} pieces
                        {bill.status === "priced" && (
                          <> · ₹{bill.totalAmount.toLocaleString("en-IN")}</>
                        )}
                      </p>
                    </div>
                    <ChevronDownIcon
                      width={18}
                      height={18}
                      className={`shrink-0 text-ink-300 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="border-t border-ink-100 p-4">
                      <ul className="space-y-1.5">
                        {bill.items.map((it) => (
                          <li
                            key={it.parcelId}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-ink-700">
                              <span className="font-semibold text-blue-600">{it.dNumber}</span>{" "}
                              — {it.name}
                            </span>
                            {bill.status === "priced" && (
                              <span className="tabular-nums font-medium text-ink-900">
                                ₹{it.price.toLocaleString("en-IN")}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {bill.note && (
                        <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
                          {bill.note}
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Link
                          to={`/dealer-bills/${bill._id}?mode=items`}
                          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-white text-sm font-semibold text-indigo-700 active:scale-[0.98]"
                        >
                          <PackageIcon width={16} height={16} /> Edit Items
                        </Link>
                        <Link
                          to={`/dealer-bills/${bill._id}`}
                          className="flex h-11 flex-1 items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white active:scale-[0.98]"
                        >
                          {bill.status === "priced" ? "View / Share" : "Add Prices"}
                        </Link>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
