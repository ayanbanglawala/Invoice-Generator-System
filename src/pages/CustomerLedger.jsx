import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import * as store from "../lib/storage";
import {
  ChevronRightIcon,
  PhoneIcon,
  ReceiptIcon,
  PackageIcon,
  WalletIcon,
} from "../components/Icons";

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parcelTag(p) {
  const billed = (p.billedBillIds || []).map((b) => b.billNo);
  if (billed.length) return { label: billed.join(", "), color: "bg-green-600" };
  if (p.dealerBillId) return { label: p.dealerBillId.billNo, color: "bg-indigo-600" };
  return { label: "Pending", color: "bg-amber-500" };
}

export default function CustomerLedger() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [bills, setBills] = useState([]);
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([store.getCustomers(), store.getBills(), store.getParcels()])
      .then(([customers, allBills, allParcels]) => {
        if (cancelled) return;
        const c = customers.find((x) => x._id === id);
        setCustomer(c || null);
        setBills(
          allBills.filter(
            (b) => b.customerId === id || (c && b.customerName === c.name)
          )
        );
        setParcels(
          allParcels.filter(
            (p) => p.customerId === id || (c && p.customerName === c.name)
          )
        );
        setError("");
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-50 dark:bg-ink-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ink-50 dark:bg-ink-950 px-6 text-center">
        <p className="text-base font-semibold text-ink-800 dark:text-ink-100">
          {error ? "Could not load this customer" : "Customer not found"}
        </p>
        {error && <p className="text-sm text-ink-500 dark:text-ink-400">{error}</p>}
        <Link
          to="/customers"
          className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to Customers
        </Link>
      </div>
    );
  }

  const totalSpent = bills.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const pendingParcels = parcels.filter(
    (p) => !p.billedBillIds?.length && p.dealerPrice != null
  );
  const totalDue = pendingParcels.reduce((s, p) => s + (p.dealerPrice || 0), 0);

  return (
    <div className="min-h-dvh bg-ink-50 dark:bg-ink-950 pb-28">
      <header className="bg-white dark:bg-ink-900 px-5 pb-5 pt-6 shadow-card">
        <div className="flex items-center gap-1 text-sm text-ink-400 dark:text-ink-500">
          <Link to="/customers" className="hover:text-ink-600 dark:text-ink-300">
            Customers
          </Link>
          <ChevronRightIcon width={14} height={14} />
          <span className="text-ink-600 dark:text-ink-300">{customer.name}</span>
        </div>

        <h1 className="mt-2 text-xl font-bold text-ink-900 dark:text-white">{customer.name}</h1>
        {customer.phone && (
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400">
            <PhoneIcon width={14} height={14} /> {customer.phone}
          </p>
        )}
        {customer.address && (
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{customer.address}</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-brand-50 dark:bg-brand-950 p-3">
            <p className="text-[11px] font-medium text-brand-700 dark:text-brand-300">Bills</p>
            <p className="mt-1 text-base font-bold text-brand-900 dark:text-brand-100">{bills.length}</p>
          </div>
          <div className="rounded-xl bg-ink-50 dark:bg-ink-950 p-3">
            <p className="text-[11px] font-medium text-ink-500 dark:text-ink-400">Total Spent</p>
            <p className="mt-1 text-base font-bold text-ink-900 dark:text-white tabular-nums">
              ₹{totalSpent.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-xl bg-ink-50 dark:bg-ink-950 p-3">
            <p className="text-[11px] font-medium text-ink-500 dark:text-ink-400">Parcels</p>
            <p className="mt-1 text-base font-bold text-ink-900 dark:text-white">{parcels.length}</p>
          </div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950 p-3">
            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Pending Due</p>
            <p className="mt-1 text-base font-bold text-amber-900 dark:text-amber-100 tabular-nums">
              ₹{totalDue.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </header>

      <main className="space-y-5 px-5 pt-5">
        {totalDue > 0 && (
          <Link
            to={`/bills/new?customerId=${customer._id}`}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-semibold text-white shadow-card active:scale-[0.98]"
          >
            <WalletIcon width={17} height={17} />
            Create Bill for {pendingParcels.length} Pending Piece
            {pendingParcels.length === 1 ? "" : "s"}
          </Link>
        )}

        <section>
          <h2 className="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold text-ink-700 dark:text-ink-200">
            <ReceiptIcon width={15} height={15} /> Bills
          </h2>
          {bills.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-4 py-6 text-center text-sm text-ink-400 dark:text-ink-500">
              No bills yet for this customer.
            </p>
          ) : (
            <ul className="space-y-2">
              {bills
                .slice()
                .sort((a, b) => new Date(b.dateOfIssue) - new Date(a.dateOfIssue))
                .map((bill) => (
                  <li key={bill._id}>
                    <Link
                      to={`/bills/${bill._id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-3.5 shadow-card active:scale-[0.99]"
                    >
                      <div className="min-w-0">
                        <p className="text-base font-extrabold text-red-600 dark:text-red-400">
                          {bill.billNo}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                          {formatDate(bill.dateOfIssue)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-[15px] font-bold text-ink-900 dark:text-white">
                          ₹{bill.totalAmount.toLocaleString("en-IN")}
                        </span>
                        <ChevronRightIcon width={16} height={16} className="text-ink-300" />
                      </div>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold text-ink-700 dark:text-ink-200">
            <PackageIcon width={15} height={15} /> Parcels
          </h2>
          {parcels.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-4 py-6 text-center text-sm text-ink-400 dark:text-ink-500">
              No parcel photos yet for this customer.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {parcels
                .slice()
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((p) => {
                  const tag = parcelTag(p);
                  return (
                    <div
                      key={p._id}
                      className="overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card"
                    >
                      <div className="relative aspect-square w-full bg-ink-50 dark:bg-ink-950">
                        <img
                          src={p.imageUrl}
                          alt={p.note}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow">
                          {p.dNumber}
                        </span>
                        <span
                          className={`absolute bottom-1.5 left-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white shadow ${tag.color}`}
                        >
                          {tag.label}
                        </span>
                      </div>
                      <p className="truncate px-1.5 py-1.5 text-[11px] text-ink-600 dark:text-ink-300">
                        {p.note}
                      </p>
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
