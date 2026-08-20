import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as store from "../lib/storage";
import InvoiceTemplate from "../components/InvoiceTemplate";
import { PlusIcon, TrashIcon, XIcon } from "../components/Icons";

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function emptyItem() {
  return { id: crypto.randomUUID(), sr: "", name: "", qty: 1, price: "", parcelId: null };
}

function itemFromParcel(parcel) {
  return {
    id: crypto.randomUUID(),
    sr: parcel.dNumber,
    name: parcel.note,
    qty: 1,
    // Pre-fill from the dealer-priced amount when available (still fully
    // editable) so bills created from the Pending Payments list don't need
    // prices typed in by hand.
    price: parcel.dealerPrice != null ? String(parcel.dealerPrice) : "",
    parcelId: parcel._id,
  };
}

export default function CreateBill() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const business = store.getBusiness();
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [parcels, setParcels] = useState([]);
  const [showAllParcels, setShowAllParcels] = useState(false);
  const [selectedParcelId, setSelectedParcelId] = useState("");

  useEffect(() => {
    store
      .getCustomers()
      .then((list) => {
        setCustomers(list);
        const presetId = searchParams.get("customerId");
        if (presetId) {
          const match = list.find((c) => c._id === presetId);
          if (match) {
            setCustomerId(match._id);
            setCustomerName(match.name);
            setCustomerPhone(match.phone || "");
          }
        }
      })
      .catch((err) => setError(`Could not load customers: ${err.message}`))
      .finally(() => setLoadingCustomers(false));
    store.getParcels().then(setParcels).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [dateOfIssue, setDateOfIssue] = useState(todayISO());
  const [billNo, setBillNo] = useState("");
  // True when the bill number came from a dealer bundle (via the "Create
  // Bill for A:xxx" button on the Home pending-payments list) — locked so
  // the customer bill always carries the exact same number as the dealer
  // bill it was priced under, with nothing to type or pick.
  const [billNoLocked, setBillNoLocked] = useState(false);
  const [items, setItems] = useState([emptyItem()]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Auto-load parcels passed via ?parcelIds=id1,id2,... (used by the
  // "Create Bill for <bill>" buttons on the Home pending-payments list) —
  // pre-fills one item per parcel, price included but still editable, so
  // nothing has to be typed in by hand. Also locks the bill number to the
  // dealer bundle's own number, since it should carry straight through.
  useEffect(() => {
    if (parcels.length === 0) return;
    const idsParam = searchParams.get("parcelIds");
    if (!idsParam) return;
    const ids = idsParam.split(",").filter(Boolean);
    if (ids.length === 0) return;
    const matched = ids
      .map((id) => parcels.find((p) => p._id === id))
      .filter(Boolean);
    if (matched.length === 0) return;
    setItems(matched.map(itemFromParcel));
    const dealerBillNo = matched[0]?.dealerBillId?.billNo;
    if (dealerBillNo) {
      setBillNo(dealerBillNo);
      setBillNoLocked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcels]);

  const totals = useMemo(() => store.computeTotals(items), [items]);

  function handleSelectCustomer(id) {
    if (id === "__new__") {
      setShowNewCustomer(true);
      return;
    }
    setCustomerId(id);
    const c = customers.find((x) => x._id === id);
    if (c) {
      setCustomerName(c.name);
      setCustomerPhone(c.phone || "");
    }
  }

  async function handleAddNewCustomer(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const created = await store.saveCustomer({
        name: newName.trim(),
        phone: newPhone.trim(),
      });
      const list = await store.getCustomers();
      setCustomers(list);
      setCustomerId(created._id);
      setCustomerName(created.name);
      setCustomerPhone(created.phone || "");
      setNewName("");
      setNewPhone("");
      setShowNewCustomer(false);
    } catch (err) {
      alert(err.message);
    }
  }

  function updateItem(id, field, value) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function addItemFromParcel(parcelId) {
    if (!parcelId) return;
    const parcel = parcels.find((p) => p._id === parcelId);
    if (!parcel) return;
    setItems((prev) => {
      // Replace a single still-blank row instead of stacking an empty one.
      const blankIdx = prev.findIndex(
        (it) => !it.parcelId && !it.name.trim() && it.price === ""
      );
      const newItem = itemFromParcel(parcel);
      if (blankIdx !== -1) {
        const next = [...prev];
        next[blankIdx] = newItem;
        return next;
      }
      return [...prev, newItem];
    });
    setSelectedParcelId("");
  }

  const usedParcelIds = new Set(items.map((it) => it.parcelId).filter(Boolean));
  const availableParcels = parcels.filter(
    (p) => !usedParcelIds.has(p._id) && (showAllParcels || !p.billedBillIds?.length)
  );

  function removeItem(id) {
    setItems((prev) =>
      prev.length > 1 ? prev.filter((it) => it.id !== id) : prev
    );
  }

  function validate() {
    if (!billNo.trim()) return "Please enter a bill / invoice number.";
    if (!customerName.trim()) return "Please select or add a customer.";
    const valid = items.filter(
      (it) => it.name.trim() && Number(it.qty) > 0 && it.price !== ""
    );
    if (valid.length === 0) return "Add at least one item with name, qty and price.";
    return "";
  }

  async function handleSave() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    const cleanItems = items
      .filter((it) => it.name.trim() && Number(it.qty) > 0 && it.price !== "")
      .map((it, idx) => ({
        sr: it.sr.trim() || String(idx + 1),
        name: it.name.trim(),
        qty: Number(it.qty),
        price: Number(it.price),
        parcelId: it.parcelId || null,
      }));

    setSaving(true);
    try {
      const bill = await store.createBill({
        billNo: billNo.trim(),
        customerId: customerId || null,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        dateOfIssue,
        items: cleanItems,
        note: note.trim(),
      });
      navigate(`/bills/${bill._id}`, { replace: true });
    } catch (err2) {
      setError(err2.message);
      setSaving(false);
    }
  }

  const previewBill = {
    billNo: billNo || "Your bill number",
    customerName: customerName || "Customer name",
    customerPhone,
    dateOfIssue,
    items: items.filter((it) => it.name || it.price),
    note,
  };

  return (
    <div className="min-h-dvh bg-ink-50 dark:bg-ink-950 pb-32">
      <header className="bg-white dark:bg-ink-900 px-5 pb-4 pt-6 shadow-card">
        <h1 className="text-xl font-bold text-ink-900 dark:text-white">New Bill</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          Fill in the details below to generate an invoice
        </p>
      </header>

      <main className="space-y-4 px-5 pt-4">
        {/* Customer */}
        <section className="rounded-2xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-ink-700 dark:text-ink-200">
            Bill To
          </h2>
          <select
            value={customerId}
            onChange={(e) => handleSelectCustomer(e.target.value)}
            disabled={loadingCustomers}
            className="h-12 w-full rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
          >
            <option value="">
              {loadingCustomers ? "Loading customers…" : "Select a customer…"}
            </option>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
                {c.phone ? ` · ${c.phone}` : ""}
              </option>
            ))}
            <option value="__new__">+ Add new customer</option>
          </select>

          {customerName && !showNewCustomer && (
            <div className="mt-3 rounded-xl bg-ink-50 dark:bg-ink-950 px-3.5 py-2.5 text-sm">
              <p className="font-medium text-ink-800 dark:text-ink-100">{customerName}</p>
              {customerPhone && (
                <p className="text-ink-500 dark:text-ink-400">{customerPhone}</p>
              )}
            </div>
          )}
        </section>

        {/* Bill number */}
        <section className="rounded-2xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
          <label className="mb-1.5 block text-sm font-semibold text-ink-700 dark:text-ink-200">
            Bill / Invoice Number
          </label>
          <input
            value={billNo}
            onChange={(e) => !billNoLocked && setBillNo(e.target.value)}
            readOnly={billNoLocked}
            placeholder="e.g. INV-101 or 24"
            className={`h-12 w-full rounded-xl border border-ink-200 dark:border-ink-700 px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 ${
              billNoLocked ? "bg-ink-50 dark:bg-ink-950 font-semibold" : ""
            }`}
            required
          />
          {billNoLocked && (
            <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">
              Carried over from the dealer bill this was priced under.
            </p>
          )}
        </section>

        {/* Date */}
        <section className="rounded-2xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
          <label className="mb-1.5 block text-sm font-semibold text-ink-700 dark:text-ink-200">
            Date of Issue
          </label>
          <input
            type="date"
            value={dateOfIssue}
            onChange={(e) => setDateOfIssue(e.target.value)}
            className="h-12 w-full rounded-xl border border-ink-200 dark:border-ink-700 px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </section>

        {/* Items */}
        <section className="rounded-2xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-200">Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="flex h-9 items-center gap-1 rounded-full bg-brand-50 dark:bg-brand-950 px-3 text-xs font-semibold text-brand-700 dark:text-brand-300 active:scale-95"
            >
              <PlusIcon width={15} height={15} /> Add Item
            </button>
          </div>

          {parcels.length > 0 && (
            <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
              <label className="mb-1.5 block text-xs font-semibold text-blue-800">
                Add from Parcels
              </label>
              <select
                value={selectedParcelId}
                onChange={(e) => addItemFromParcel(e.target.value)}
                className="h-11 w-full rounded-lg border border-blue-200 bg-white dark:bg-ink-900 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                <option value="">
                  {availableParcels.length === 0
                    ? "No parcels available"
                    : "Select a parcel photo…"}
                </option>
                {availableParcels.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.dNumber} — {p.note} ({p.customerName})
                    {p.billedBillIds?.length ? " · already billed" : ""}
                  </option>
                ))}
              </select>
              <label className="mt-2 flex items-center gap-2 text-xs font-medium text-blue-800">
                <input
                  type="checkbox"
                  checked={showAllParcels}
                  onChange={(e) => setShowAllParcels(e.target.checked)}
                  className="h-4 w-4 rounded border-blue-300"
                />
                Show already-billed photos too (for dealer bills)
              </label>
            </div>
          )}

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="rounded-xl border border-ink-100 dark:border-ink-800 p-3"
              >
                <div className="mb-2 flex items-end gap-2">
                  <div className="w-20 shrink-0">
                    <label className="mb-1 block text-xs text-ink-500 dark:text-ink-400">
                      SR
                    </label>
                    <input
                      value={item.sr}
                      onChange={(e) => updateItem(item.id, "sr", e.target.value)}
                      placeholder={`D${idx + 1}`}
                      className="h-11 w-full rounded-lg border border-ink-200 dark:border-ink-700 px-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                  {item.parcelId && (
                    <span className="mb-0.5 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
                      From Parcel
                    </span>
                  )}
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove item"
                      className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-ink-400 dark:text-ink-500 active:bg-red-50 dark:bg-red-950 active:text-red-600 dark:text-red-400"
                    >
                      <TrashIcon width={15} height={15} />
                    </button>
                  )}
                </div>
                <label className="mb-1 block text-xs text-ink-500 dark:text-ink-400">
                  Model Name
                </label>
                <input
                  value={item.name}
                  onChange={(e) => updateItem(item.id, "name", e.target.value)}
                  placeholder="e.g. iPhone 17 256"
                  className="mb-2 h-11 w-full rounded-lg border border-ink-200 dark:border-ink-700 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-ink-500 dark:text-ink-400">
                      Qty
                    </label>
                    <input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={item.qty}
                      onChange={(e) =>
                        updateItem(item.id, "qty", e.target.value)
                      }
                      className="h-11 w-full rounded-lg border border-ink-200 dark:border-ink-700 px-3 text-sm tabular-nums outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-500 dark:text-ink-400">
                      Bill Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={item.price}
                      onChange={(e) =>
                        updateItem(item.id, "price", e.target.value)
                      }
                      placeholder="75000"
                      className="h-11 w-full rounded-lg border border-ink-200 dark:border-ink-700 px-3 text-sm tabular-nums outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-ink-400 dark:text-ink-500">Total (auto)</span>
                  <span className="font-semibold tabular-nums text-ink-700 dark:text-ink-200">
                    ₹
                    {(
                      Number(item.qty || 0) * Number(item.price || 0)
                    ).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-ink-100 dark:border-ink-800 pt-3 text-base font-bold text-ink-900 dark:text-white">
            <span>Total</span>
            <span className="tabular-nums">
              ₹{totals.totalAmount.toLocaleString("en-IN")}
            </span>
          </div>
        </section>

        {/* Note */}
        <section className="rounded-2xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-card">
          <label className="mb-1.5 block text-sm font-semibold text-ink-700 dark:text-ink-200">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Warranty valid for 6 months"
            className="w-full rounded-xl border border-ink-200 dark:border-ink-700 px-4 py-3 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </section>

        {error && (
          <p role="alert" className="px-1 text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {/* Live preview */}
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-ink-700 dark:text-ink-200">
            Live Preview
          </h2>
          <div className="overflow-x-auto rounded-2xl bg-ink-100/50 p-4">
            <InvoiceTemplate business={business} bill={previewBill} />
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-[52px] w-full rounded-xl bg-brand-500 text-base font-semibold text-white shadow-pop active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save & Generate Invoice"}
        </button>
      </div>

      {showNewCustomer && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm">
          <form
            onSubmit={handleAddNewCustomer}
            className="w-full rounded-t-3xl bg-white dark:bg-ink-900 p-5 pb-8 shadow-pop"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-900 dark:text-white">
                Add New Customer
              </h2>
              <button
                type="button"
                onClick={() => setShowNewCustomer(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-50 dark:bg-ink-950 text-ink-500 dark:text-ink-400"
              >
                <XIcon width={18} height={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
                  Name
                </label>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-12 w-full rounded-xl border border-ink-200 dark:border-ink-700 px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
                  Phone
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="h-12 w-full rounded-xl border border-ink-200 dark:border-ink-700 px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <button
                type="submit"
                className="h-12 w-full rounded-xl bg-brand-500 text-base font-semibold text-white shadow-card active:scale-[0.98]"
              >
                Add & Select
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}