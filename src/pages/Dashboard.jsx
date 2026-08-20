import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as store from "../lib/storage";
import { useAuth } from "../context/AuthContext";
import {
  LogoutIcon,
  SearchIcon,
  ChevronRightIcon,
  ReceiptIcon,
  SettingsIcon,
} from "../components/Icons";

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

export default function Dashboard() {
  const { signOut } = useAuth();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState([]);
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openMonth, setOpenMonth] = useState(null);
  const [openPendingCustomer, setOpenPendingCustomer] = useState(null);
  const [showPending, setShowPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([store.getBillsGrouped(), store.getParcels()])
      .then(([billGroups, parcelList]) => {
        if (cancelled) return;
        setGroups(billGroups);
        setParcels(parcelList);
        setOpenMonth(billGroups[0]?.monthKey ?? null);
        setError("");
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingPaymentGroups = useMemo(() => {
    const eligible = parcels.filter(
      (p) => !p.billedBillIds?.length && p.dealerPrice != null
    );
    const map = new Map();
    for (const p of eligible) {
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
  }, [parcels]);

  const totalPendingAmount = pendingPaymentGroups.reduce((s, g) => s + g.totalPending, 0);
  const totalPendingPieces = pendingPaymentGroups.reduce((s, g) => s + g.pieces.length, 0);

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
              {totalInvoices}
            </p>
          </div>
          <div className="rounded-xl bg-ink-50 dark:bg-ink-950 p-3">
            <p className="text-[11px] font-medium text-ink-500 dark:text-ink-400">Billed</p>
            <p className="mt-1 text-base font-bold text-ink-900 dark:text-white tabular-nums">
              ₹{totalRevenue.toLocaleString("en-IN")}
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
                  {totalPendingPieces} piece{totalPendingPieces === 1 ? "" : "s"} priced by
                  dealer, not yet billed to customer
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-sm font-extrabold text-amber-900 dark:text-amber-100">
                  ₹{totalPendingAmount.toLocaleString("en-IN")}
                </span>
                <ChevronRightIcon
                  width={16}
                  height={16}
                  className={`text-amber-500 transition-transform ${
                    showPending ? "rotate-90" : ""
                  }`}
                />
              </div>
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
                        onClick={() =>
                          setOpenPendingCustomer(isOpen ? null : group.key)
                        }
                        className="flex w-full items-center justify-between px-3 py-2.5"
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
        ) : filteredGroups.length === 0 ? (
          <EmptyState hasQuery={!!query} />
        ) : (
          <div className="space-y-4">
            {filteredGroups.map((group) => {
              const isOpen = openMonth === group.monthKey || !!query;
              return (
                <section
                  key={group.monthKey}
                  className="overflow-hidden rounded-2xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card"
                >
                  <button
                    onClick={() =>
                      setOpenMonth(isOpen && !query ? null : group.monthKey)
                    }
                    className="flex w-full items-center justify-between px-4 py-3.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-ink-900 dark:text-white">
                        {group.monthLabel}
                      </span>
                      <span className="rounded-full bg-ink-50 dark:bg-ink-950 px-2 py-0.5 text-xs font-semibold text-ink-500 dark:text-ink-400">
                        {group.count}
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