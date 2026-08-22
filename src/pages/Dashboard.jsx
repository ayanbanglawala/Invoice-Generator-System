import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as store from "../lib/storage";
import { useAuth } from "../context/AuthContext";
import { useInfiniteScroll } from "../lib/useInfiniteScroll";
import {
  LogoutIcon,
  SearchIcon,
  ChevronRightIcon,
  ReceiptIcon,
  SettingsIcon,
} from "../components/Icons";

const BILLS_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Splits a customer's pending pieces up by which dealer bundle/bill they
// came from, preserving the order bills first appear in.
function groupPiecesByDealerBill(pieces) {
  const groups = [];
  const indexByBillId = new Map();
  for (const p of pieces) {
    const key = p.dealerBillId?._id || "no-bill";
    const label = p.dealerBillId?.billNo || "No dealer bill";
    if (!indexByBillId.has(key)) {
      indexByBillId.set(key, groups.length);
      groups.push({ key, billNo: label, pieces: [] });
    }
    groups[indexByBillId.get(key)].pieces.push(p);
  }
  return groups;
}

// Client-side groups the currently-loaded (paginated) bills by month.
// Since bills arrive from the server already sorted newest-first, this
// never needs to re-sort — each page's bills either extend the last group
// or start a new one.
function groupBillsByMonth(bills) {
  const groups = [];
  const indexByMonth = new Map();
  for (const b of bills) {
    if (!indexByMonth.has(b.monthKey)) {
      indexByMonth.set(b.monthKey, groups.length);
      groups.push({ monthKey: b.monthKey, monthLabel: b.monthLabel, bills: [], totalAmount: 0 });
    }
    const g = groups[indexByMonth.get(b.monthKey)];
    g.bills.push(b);
    g.totalAmount += b.totalAmount;
  }
  return groups;
}

export default function Dashboard() {
  const { signOut } = useAuth();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [bills, setBills] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ count: 0, totalAmount: 0 });
  const [pendingParcels, setPendingParcels] = useState([]);
  const [openMonth, setOpenMonth] = useState(null);
  const [openPendingCustomer, setOpenPendingCustomer] = useState(null);
  const [showPending, setShowPending] = useState(true);
  const firstLoadDone = useRef(false);

  // Debounce search input so we're not hitting the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Stats + pending payments load once — both are lightweight, aggregate
  // -style endpoints, not the full bill/parcel history.
  useEffect(() => {
    store.getBillsStats().then(setStats).catch(() => {});
    store.getPendingParcels().then(setPendingParcels).catch(() => {});
  }, []);

  // (Re)load the first page of bills whenever the search term changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(!firstLoadDone.current);
    setBills([]);
    setPage(1);
    setHasMore(true);
    store
      .getBills({ page: 1, limit: BILLS_PAGE_SIZE, ...(debouncedQuery ? { q: debouncedQuery } : {}) })
      .then((res) => {
        if (cancelled) return;
        setBills(res.bills);
        setHasMore(res.hasMore);
        setOpenMonth(res.bills[0]?.monthKey ?? null);
        setError("");
        firstLoadDone.current = true;
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const loadMore = useMemo(
    () => async () => {
      if (loadingMore || !hasMore) return;
      setLoadingMore(true);
      try {
        const nextPage = page + 1;
        const res = await store.getBills({
          page: nextPage,
          limit: BILLS_PAGE_SIZE,
          ...(debouncedQuery ? { q: debouncedQuery } : {}),
        });
        setBills((prev) => [...prev, ...res.bills]);
        setHasMore(res.hasMore);
        setPage(nextPage);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingMore(false);
      }
    },
    [loadingMore, hasMore, page, debouncedQuery]
  );

  const sentinelRef = useInfiniteScroll({ hasMore, loading: loadingMore, onLoadMore: loadMore });

  const pendingPaymentGroups = useMemo(() => {
    const map = new Map();
    for (const p of pendingParcels) {
      const key = p.customerId || p.customerName;
      if (!map.has(key)) {
        map.set(key, { key, customerId: p.customerId, customerName: p.customerName, pieces: [] });
      }
      map.get(key).pieces.push(p);
    }
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        totalPending: g.pieces.reduce((s, p) => s + (p.dealerPrice || 0), 0),
      }))
      .sort((a, b) => b.totalPending - a.totalPending);
  }, [pendingParcels]);

  const totalPendingAmount = pendingPaymentGroups.reduce((s, g) => s + g.totalPending, 0);
  const totalPendingPieces = pendingPaymentGroups.reduce((s, g) => s + g.pieces.length, 0);

  const groupedBills = useMemo(() => groupBillsByMonth(bills), [bills]);

  return (
    <div className="min-h-dvh bg-ink-50 dark:bg-ink-950 pb-28">
      <header className="bg-white dark:bg-ink-900 px-5 pb-5 pt-6 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ink-500 dark:text-ink-400">Welcome back</p>
            <h1 className="text-xl font-bold text-ink-900 dark:text-white">All Bills</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/settings"
              aria-label="Settings"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-50 dark:bg-ink-950 text-ink-500 dark:text-ink-400 transition-colors active:bg-ink-100 dark:bg-ink-800"
            >
              <SettingsIcon width={20} height={20} />
            </Link>
            <button
              onClick={signOut}
              aria-label="Log out"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-50 dark:bg-ink-950 text-ink-500 dark:text-ink-400 transition-colors active:bg-ink-100 dark:bg-ink-800"
            >
              <LogoutIcon width={20} height={20} />
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-brand-50 dark:bg-brand-950 p-3">
            <p className="text-[11px] font-medium text-brand-700 dark:text-brand-300">Invoices</p>
            <p className="mt-1 text-base font-bold text-brand-900 dark:text-brand-100">
              {stats.count}
            </p>
          </div>
          <div className="rounded-xl bg-ink-50 dark:bg-ink-950 p-3">
            <p className="text-[11px] font-medium text-ink-500 dark:text-ink-400">Billed</p>
            <p className="mt-1 text-base font-bold text-ink-900 dark:text-white tabular-nums">
              ₹{stats.totalAmount.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950 p-3">
            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Pending</p>
            <p className="mt-1 text-base font-bold text-amber-900 dark:text-amber-100 tabular-nums">
              ₹{totalPendingAmount.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        <div className="relative mt-4">
          <SearchIcon
            width={18}
            height={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by customer or bill number"
            className="h-11 w-full rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 pl-10 pr-4 text-sm text-ink-800 dark:text-ink-100 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </header>

      <main className="px-5 pt-4">
        {error && (
          <div className="mb-3 rounded-xl border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            Could not load bills: {error}. Is the API server running?
          </div>
        )}

        {!loading && pendingPaymentGroups.length > 0 && (
          <section className="mb-5 overflow-hidden rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 shadow-card">
            <button
              onClick={() => setShowPending((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3.5"
            >
              <div>
                <p className="text-[15px] font-bold text-amber-900 dark:text-amber-100">
                  Pending Payments
                </p>
                <p className="mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                  {totalPendingPieces} pieces priced by dealer, not yet billed to customer
                </p>
              </div>
              <ChevronRightIcon
                width={16}
                height={16}
                className={`shrink-0 text-amber-400 transition-transform ${
                  showPending ? "rotate-90" : ""
                }`}
              />
            </button>

            {showPending && (
              <div className="space-y-2 border-t border-amber-200 dark:border-amber-800 p-3">
                {pendingPaymentGroups.map((group) => {
                  const isOpen = openPendingCustomer === group.key;
                  return (
                    <div
                      key={group.key}
                      className="overflow-hidden rounded-xl border border-amber-100 dark:border-amber-900 bg-white dark:bg-ink-900"
                    >
                      <button
                        onClick={() => setOpenPendingCustomer(isOpen ? null : group.key)}
                        className="flex w-full items-center justify-between px-3.5 py-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink-900 dark:text-white">
                            {group.customerName}
                          </span>
                          <span className="rounded-full bg-amber-100 dark:bg-amber-900 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-200">
                            {group.pieces.length} pending
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="tabular-nums text-sm font-bold text-ink-900 dark:text-white">
                            ₹{group.totalPending.toLocaleString("en-IN")}
                          </span>
                          <ChevronRightIcon
                            width={14}
                            height={14}
                            className={`text-ink-300 transition-transform ${
                              isOpen ? "rotate-90" : ""
                            }`}
                          />
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-ink-100 dark:border-ink-800 p-3">
                          <div className="space-y-3">
                            {groupPiecesByDealerBill(group.pieces).map((dBill) => (
                              <div key={dBill.key}>
                                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                  {dBill.billNo}
                                </p>
                                <ul className="space-y-1.5">
                                  {dBill.pieces.map((p) => (
                                    <li
                                      key={p._id}
                                      className="flex items-center justify-between text-sm"
                                    >
                                      <span className="text-ink-700 dark:text-ink-200">
                                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                                          {p.dNumber}
                                        </span>{" "}
                                        — {p.note}
                                      </span>
                                      <span className="tabular-nums font-medium text-ink-900 dark:text-white">
                                        ₹{p.dealerPrice.toLocaleString("en-IN")}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                                <Link
                                  to={`/bills/new?customerId=${group.customerId || ""}&parcelIds=${dBill.pieces
                                    .map((p) => p._id)
                                    .join(",")}`}
                                  className="mt-2 flex h-10 w-full items-center justify-center rounded-lg bg-brand-500 text-sm font-semibold text-white active:scale-[0.98]"
                                >
                                  Create Bill for {dBill.billNo}
                                </Link>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {loading ? (
          <LoadingState />
        ) : groupedBills.length === 0 ? (
          <EmptyState hasQuery={!!debouncedQuery} />
        ) : (
          <div className="space-y-4">
            {groupedBills.map((group) => {
              const isOpen = openMonth === group.monthKey || !!debouncedQuery;
              return (
                <section
                  key={group.monthKey}
                  className="overflow-hidden rounded-2xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card"
                >
                  <button
                    onClick={() =>
                      setOpenMonth(isOpen && !debouncedQuery ? null : group.monthKey)
                    }
                    className="flex w-full items-center justify-between px-4 py-3.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-ink-900 dark:text-white">
                        {group.monthLabel}
                      </span>
                      <span className="rounded-full bg-ink-50 dark:bg-ink-950 px-2 py-0.5 text-xs font-semibold text-ink-500 dark:text-ink-400">
                        {group.bills.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-sm font-semibold text-ink-700 dark:text-ink-200">
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
                    <ul className="space-y-2 border-t border-ink-100 dark:border-ink-800 p-3">
                      {group.bills.map((bill) => (
                        <li key={bill._id}>
                          <Link
                            to={`/bills/${bill._id}`}
                            className="flex items-center justify-between gap-3 rounded-xl bg-ink-50/60 p-3 transition-transform active:scale-[0.99]"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[15px] font-semibold text-ink-900 dark:text-white">
                                {bill.customerName}
                              </p>
                              <p className="mt-0.5 text-xs font-medium text-ink-500 dark:text-ink-400">
                                {formatDate(bill.dateOfIssue)}
                              </p>
                              <p className="mt-0.5 text-base font-extrabold text-red-600 dark:text-red-400">
                                {bill.billNo}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums text-[15px] font-bold text-ink-900 dark:text-white">
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

            {/* Infinite scroll sentinel — loads the next page of bills the
                moment this scrolls near the viewport. Nothing renders once
                every bill has been loaded. */}
            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
              </div>
            )}
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
          className="h-16 animate-pulse rounded-2xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card"
        />
      ))}
    </div>
  );
}

function EmptyState({ hasQuery }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950 text-brand-500">
        <ReceiptIcon width={26} height={26} />
      </div>
      <p className="mt-4 text-[15px] font-semibold text-ink-800 dark:text-ink-100">
        {hasQuery ? "No matching bills" : "No bills yet"}
      </p>
      <p className="mt-1 max-w-[220px] text-sm text-ink-500 dark:text-ink-400">
        {hasQuery
          ? "Try a different search term."
          : "Tap the + button below to create your first invoice."}
      </p>
    </div>
  );
}