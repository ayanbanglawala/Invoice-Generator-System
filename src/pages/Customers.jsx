import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as store from "../lib/storage";
import { PlusIcon, TrashIcon, UsersIcon, XIcon, PhoneIcon, PencilIcon, ChevronRightIcon } from "../components/Icons";

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
    <div className="min-h-dvh bg-ink-50 dark:bg-ink-950 pb-28">
      <header className="flex items-center justify-between bg-white dark:bg-ink-900 px-5 pb-4 pt-6 shadow-card">
        <h1 className="text-xl font-bold text-ink-900 dark:text-white">Customers</h1>
        <button
          onClick={openNew}
          className="flex h-10 items-center gap-1.5 rounded-full bg-brand-500 px-4 text-sm font-semibold text-white shadow-card active:scale-95"
        >
          <PlusIcon width={18} height={18} /> Add
        </button>
      </header>

      <main className="px-5 pt-4">
        {error && (
          <div className="mb-3 rounded-xl border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            Could not load customers: {error}. Is the API server running?
          </div>
        )}

        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-2xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card"
              />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950 text-brand-500">
              <UsersIcon width={26} height={26} />
            </div>
            <p className="mt-4 text-[15px] font-semibold text-ink-800 dark:text-ink-100">
              No customers yet
            </p>
            <p className="mt-1 max-w-[220px] text-sm text-ink-500 dark:text-ink-400">
              Add a customer so you can pick them quickly while billing.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {customers.map((c) => (
              <li
                key={c._id}
                className="flex items-center gap-2 rounded-2xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-2 pl-4 shadow-card"
              >
                <Link
                  to={`/customers/${c._id}`}
                  className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink-900 dark:text-white">
                      {c.name}
                    </p>
                    {c.phone && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                        <PhoneIcon width={12} height={12} /> {c.phone}
                      </p>
                    )}
                  </div>
                  <ChevronRightIcon width={16} height={16} className="shrink-0 text-ink-300" />
                </Link>
                <button
                  onClick={() => openEdit(c)}
                  aria-label={`Edit ${c.name}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-400 dark:text-ink-500 transition-colors active:bg-ink-50 dark:bg-ink-950 active:text-ink-700 dark:text-ink-200"
                >
                  <PencilIcon width={17} height={17} />
                </button>
                <button
                  onClick={() => handleDelete(c._id)}
                  aria-label={`Delete ${c.name}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-400 dark:text-ink-500 transition-colors active:bg-red-50 dark:bg-red-950 active:text-red-600 dark:text-red-400"
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
            className="w-full rounded-t-3xl bg-white dark:bg-ink-900 p-5 pb-8 shadow-pop"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-900 dark:text-white">
                {editing ? "Edit Customer" : "Add Customer"}
              </h2>
              <button
                type="button"
                onClick={resetForm}
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Customer name"
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
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="h-12 w-full rounded-xl border border-ink-200 dark:border-ink-700 px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
                  Address (optional)
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Address"
                  rows={2}
                  className="w-full rounded-xl border border-ink-200 dark:border-ink-700 px-4 py-3 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
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
