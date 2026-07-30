import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as store from "../lib/storage";
import InvoiceTemplate from "../components/InvoiceTemplate";
import { PlusIcon, TrashIcon, XIcon } from "../components/Icons";

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function emptyItem() {
  return { id: crypto.randomUUID(), sr: "", name: "", qty: 1, price: "" };
}

export default function CreateBill() {
  const navigate = useNavigate();
  const business = store.getBusiness();
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  useEffect(() => {
    store
      .getCustomers()
      .then(setCustomers)
      .catch((err) => setError(`Could not load customers: ${err.message}`))
      .finally(() => setLoadingCustomers(false));
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
  const [items, setItems] = useState([emptyItem()]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
    <div className="min-h-dvh bg-ink-50 pb-32">
      <header className="bg-white px-5 pb-4 pt-6 shadow-card">
        <h1 className="text-xl font-bold text-ink-900">New Bill</h1>
        <p className="mt-1 text-sm text-ink-500">
          Fill in the details below to generate an invoice
        </p>
      </header>

      <main className="space-y-4 px-5 pt-4">
        {/* Customer */}
        <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-ink-700">
            Bill To
          </h2>
          <select
            value={customerId}
            onChange={(e) => handleSelectCustomer(e.target.value)}
            disabled={loadingCustomers}
            className="h-12 w-full rounded-xl border border-ink-200 bg-white px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
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
            <div className="mt-3 rounded-xl bg-ink-50 px-3.5 py-2.5 text-sm">
              <p className="font-medium text-ink-800">{customerName}</p>
              {customerPhone && (
                <p className="text-ink-500">{customerPhone}</p>
              )}
            </div>
          )}
        </section>

        {/* Bill number */}
        <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
          <label className="mb-1.5 block text-sm font-semibold text-ink-700">
            Bill / Invoice Number
          </label>
          <input
            value={billNo}
            onChange={(e) => setBillNo(e.target.value)}
            placeholder="e.g. INV-101 or 24"
            className="h-12 w-full rounded-xl border border-ink-200 px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            required
          />
        </section>

        {/* Date */}
        <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
          <label className="mb-1.5 block text-sm font-semibold text-ink-700">
            Date of Issue
          </label>
          <input
            type="date"
            value={dateOfIssue}
            onChange={(e) => setDateOfIssue(e.target.value)}
            className="h-12 w-full rounded-xl border border-ink-200 px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </section>

        {/* Items */}
        <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-700">Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="flex h-9 items-center gap-1 rounded-full bg-brand-50 px-3 text-xs font-semibold text-brand-700 active:scale-95"
            >
              <PlusIcon width={15} height={15} /> Add Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="rounded-xl border border-ink-100 p-3"
              >
                <div className="mb-2 flex items-end gap-2">
                  <div className="w-20 shrink-0">
                    <label className="mb-1 block text-xs text-ink-500">
                      SR
                    </label>
                    <input
                      value={item.sr}
                      onChange={(e) => updateItem(item.id, "sr", e.target.value)}
                      placeholder={`D${idx + 1}`}
                      className="h-11 w-full rounded-lg border border-ink-200 px-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove item"
                      className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-ink-400 active:bg-red-50 active:text-red-600"
                    >
                      <TrashIcon width={15} height={15} />
                    </button>
                  )}
                </div>
                <label className="mb-1 block text-xs text-ink-500">
                  Model Name
                </label>
                <input
                  value={item.name}
                  onChange={(e) => updateItem(item.id, "name", e.target.value)}
                  placeholder="e.g. iPhone 17 256"
                  className="mb-2 h-11 w-full rounded-lg border border-ink-200 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-ink-500">
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
                      className="h-11 w-full rounded-lg border border-ink-200 px-3 text-sm tabular-nums outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-500">
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
                      className="h-11 w-full rounded-lg border border-ink-200 px-3 text-sm tabular-nums outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-ink-400">Total (auto)</span>
                  <span className="font-semibold tabular-nums text-ink-700">
                    ₹
                    {(
                      Number(item.qty || 0) * Number(item.price || 0)
                    ).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3 text-base font-bold text-ink-900">
            <span>Total</span>
            <span className="tabular-nums">
              ₹{totals.totalAmount.toLocaleString("en-IN")}
            </span>
          </div>
        </section>

        {/* Note */}
        <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
          <label className="mb-1.5 block text-sm font-semibold text-ink-700">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Warranty valid for 6 months"
            className="w-full rounded-xl border border-ink-200 px-4 py-3 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </section>

        {error && (
          <p role="alert" className="px-1 text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        {/* Live preview */}
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-ink-700">
            Live Preview
          </h2>
          <div className="overflow-x-auto rounded-2xl bg-ink-100/50 p-4">
            <InvoiceTemplate business={business} bill={previewBill} />
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
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
            className="w-full rounded-t-3xl bg-white p-5 pb-8 shadow-pop"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-900">
                Add New Customer
              </h2>
              <button
                type="button"
                onClick={() => setShowNewCustomer(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-50 text-ink-500"
              >
                <XIcon width={18} height={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700">
                  Name
                </label>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-12 w-full rounded-xl border border-ink-200 px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700">
                  Phone
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="h-12 w-full rounded-xl border border-ink-200 px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
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
