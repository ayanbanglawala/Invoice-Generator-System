import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as store from "../lib/storage";
import { useAuth } from "../context/AuthContext";
import {
  LogoutIcon,
  SearchIcon,
  ChevronRightIcon,
  ReceiptIcon,
} from "../components/Icons";

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function Dashboard() {
  const { signOut } = useAuth();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openMonth, setOpenMonth] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    store
      .getBillsGrouped()
      .then((data) => {
        if (cancelled) return;
        setGroups(data);
        setOpenMonth(data[0]?.monthKey ?? null);
        setError("");
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        bills: g.bills.filter(
          (b) =>
            b.customerName?.toLowerCase().includes(q) ||
            b.billNo?.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.bills.length > 0);
  }, [groups, query]);

  const totalInvoices = groups.reduce((s, g) => s + g.count, 0);
  const totalRevenue = groups.reduce((s, g) => s + g.totalAmount, 0);

  return (
    <div className="min-h-dvh bg-ink-50 pb-28">
      <header className="bg-white px-5 pb-5 pt-6 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ink-500">Welcome back</p>
            <h1 className="text-xl font-bold text-ink-900">All Bills</h1>
          </div>
          <button
            onClick={signOut}
            aria-label="Log out"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-50 text-ink-500 transition-colors active:bg-ink-100"
          >
            <LogoutIcon width={20} height={20} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-brand-50 p-3.5">
            <p className="text-xs font-medium text-brand-700">
              Total Invoices
            </p>
            <p className="mt-1 text-lg font-bold text-brand-900">
              {totalInvoices}
            </p>
          </div>
          <div className="rounded-xl bg-ink-50 p-3.5">
            <p className="text-xs font-medium text-ink-500">Total Billed</p>
            <p className="mt-1 text-lg font-bold text-ink-900 tabular-nums">
              ₹{totalRevenue.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        <div className="relative mt-4">
          <SearchIcon
            width={18}
            height={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by customer or bill number"
            className="h-11 w-full rounded-xl border border-ink-200 bg-white pl-10 pr-4 text-sm text-ink-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </header>

      <main className="px-5 pt-4">
        {error && (
          <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load bills: {error}. Is the API server running?
          </div>
        )}

        {loading ? (
          <LoadingState />
        ) : filteredGroups.length === 0 ? (
          <EmptyState hasQuery={!!query} />
        ) : (
          <div className="space-y-4">
            {filteredGroups.map((group) => {
              const isOpen = openMonth === group.monthKey || !!query;
              return (
                <section
                  key={group.monthKey}
                  className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card"
                >
                  <button
                    onClick={() =>
                      setOpenMonth(isOpen && !query ? null : group.monthKey)
                    }
                    className="flex w-full items-center justify-between px-4 py-3.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-ink-900">
                        {group.monthLabel}
                      </span>
                      <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs font-semibold text-ink-500">
                        {group.count}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-sm font-semibold text-ink-700">
                        ₹{group.totalAmount.toLocaleString("en-IN")}
                      </span>
                      <ChevronRightIcon
                        width={16}
                        height={16}
                        className={`text-ink-300 transition-transform ${
                          isOpen ? "rotate-90" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {isOpen && (
                    <ul className="space-y-2 border-t border-ink-100 p-3">
                      {group.bills.map((bill) => (
                        <li key={bill._id}>
                          <Link
                            to={`/bills/${bill._id}`}
                            className="flex items-center justify-between gap-3 rounded-xl bg-ink-50/60 p-3 transition-transform active:scale-[0.99]"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[15px] font-semibold text-ink-900">
                                {bill.customerName}
                              </p>
                              <p className="mt-0.5 text-xs font-medium text-ink-500">
                                {formatDate(bill.dateOfIssue)}
                              </p>
                              <p className="mt-0.5 text-base font-extrabold text-red-600">
                                {bill.billNo}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums text-[15px] font-bold text-ink-900">
                                ₹{bill.totalAmount.toLocaleString("en-IN")}
                              </span>
                              <ChevronRightIcon
                                width={18}
                                height={18}
                                className="text-ink-300"
                              />
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
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

function LoadingState() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-2xl border border-ink-100 bg-white shadow-card"
        />
      ))}
    </div>
  );
}

function EmptyState({ hasQuery }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <ReceiptIcon width={26} height={26} />
      </div>
      <p className="mt-4 text-[15px] font-semibold text-ink-800">
        {hasQuery ? "No matching bills" : "No bills yet"}
      </p>
      <p className="mt-1 max-w-[220px] text-sm text-ink-500">
        {hasQuery
          ? "Try a different search term."
          : "Tap the + button below to create your first invoice."}
      </p>
    </div>
  );
}
