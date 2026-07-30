import { useEffect, useState } from "react";
import * as store from "../lib/storage";
import { PlusIcon, TrashIcon, UsersIcon, XIcon, PhoneIcon } from "../components/Icons";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  function loadCustomers() {
    setLoading(true);
    return store
      .getCustomers()
      .then((data) => {
        setCustomers(data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  function resetForm() {
    setName("");
    setPhone("");
    setAddress("");
    setEditing(null);
    setShowForm(false);
  }

  function openNew() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(customer) {
    setEditing(customer);
    setName(customer.name);
    setPhone(customer.phone || "");
    setAddress(customer.address || "");
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await store.saveCustomer({
        id: editing?._id,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      await loadCustomers();
      resetForm();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this customer? This won't affect past bills.")) return;
    try {
      await store.deleteCustomer(id);
      await loadCustomers();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="min-h-dvh bg-ink-50 pb-28">
      <header className="flex items-center justify-between bg-white px-5 pb-4 pt-6 shadow-card">
        <h1 className="text-xl font-bold text-ink-900">Customers</h1>
        <button
          onClick={openNew}
          className="flex h-10 items-center gap-1.5 rounded-full bg-brand-500 px-4 text-sm font-semibold text-white shadow-card active:scale-95"
        >
          <PlusIcon width={18} height={18} /> Add
        </button>
      </header>

      <main className="px-5 pt-4">
        {error && (
          <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load customers: {error}. Is the API server running?
          </div>
        )}

        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-2xl border border-ink-100 bg-white shadow-card"
              />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <UsersIcon width={26} height={26} />
            </div>
            <p className="mt-4 text-[15px] font-semibold text-ink-800">
              No customers yet
            </p>
            <p className="mt-1 max-w-[220px] text-sm text-ink-500">
              Add a customer so you can pick them quickly while billing.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {customers.map((c) => (
              <li
                key={c._id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-card"
              >
                <button
                  onClick={() => openEdit(c)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-[15px] font-semibold text-ink-900">
                    {c.name}
                  </p>
                  {c.phone && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
                      <PhoneIcon width={12} height={12} /> {c.phone}
                    </p>
                  )}
                </button>
                <button
                  onClick={() => handleDelete(c._id)}
                  aria-label={`Delete ${c.name}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors active:bg-red-50 active:text-red-600"
                >
                  <TrashIcon width={18} height={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm">
          <form
            onSubmit={handleSave}
            className="w-full rounded-t-3xl bg-white p-5 pb-8 shadow-pop"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-900">
                {editing ? "Edit Customer" : "Add Customer"}
              </h2>
              <button
                type="button"
                onClick={resetForm}
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Customer name"
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
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="h-12 w-full rounded-xl border border-ink-200 px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700">
                  Address (optional)
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Address"
                  rows={2}
                  className="w-full rounded-xl border border-ink-200 px-4 py-3 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="h-12 w-full rounded-xl bg-brand-500 text-base font-semibold text-white shadow-card active:scale-[0.98] disabled:opacity-60"
              >
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Customer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
