import { useEffect, useRef, useState } from "react";
import * as store from "../lib/storage";
import { fileToCompressedDataUrl, dataUrlToFile } from "../lib/image";
import {
  PlusIcon,
  CameraIcon,
  ImageUploadIcon,
  PackageIcon,
  ShareIcon,
  TrashIcon,
  XIcon,
  CheckIcon,
  CheckCircleIcon,
  ChevronDownIcon,
} from "../components/Icons";

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function captionFor(parcel) {
  return `${parcel.dNumber} — ${parcel.customerName}\n${parcel.note}`;
}

// Turns a parcel's stored image URL into a shareable File. Used for parcels
// that weren't just captured in this session (so we don't have the original
// File object sitting in memory anymore).
async function parcelToFile(parcel) {
  const res = await fetch(parcel.imageUrl);
  const blob = await res.blob();
  const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  return new File([blob], `${parcel.dNumber}.${ext}`, { type: blob.type || "image/jpeg" });
}

export default function Parcels() {
  const [parcels, setParcels] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCapture, setShowCapture] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sharingSelected, setSharingSelected] = useState(false);
  const [openCustomer, setOpenCustomer] = useState(null);

  function loadParcels() {
    setLoading(true);
    return store
      .getParcels()
      .then((data) => {
        setParcels(data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadParcels();
    store.getCustomers().then(setCustomers).catch(() => {});
  }, []);

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete(id) {
    if (!confirm("Delete this parcel photo permanently?")) return;
    try {
      await store.deleteParcel(id);
      await loadParcels();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleShareOne(parcel) {
    try {
      const file = await parcelToFile(parcel);
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: parcel.dNumber,
          text: captionFor(parcel),
        });
      } else if (navigator.share) {
        await navigator.share({ title: parcel.dNumber, text: captionFor(parcel) });
      } else {
        alert("Sharing isn't supported in this browser. Long-press the photo to save and send it manually.");
      }
    } catch (err) {
      if (err?.name !== "AbortError") alert("Could not share this photo.");
    }
  }

  async function handleShareSelected() {
    const chosen = parcels.filter((p) => selectedIds.has(p._id));
    if (chosen.length === 0) return;
    setSharingSelected(true);
    try {
      const files = await Promise.all(chosen.map(parcelToFile));
      const caption = chosen.map(captionFor).join("\n\n");

      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({ files, text: caption, title: "Parcels" });
      } else {
        alert(
          "This browser can't share multiple photos at once. Sharing them one at a time instead — tap Share again for each if the sheet closes."
        );
        for (const file of files) {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            // eslint-disable-next-line no-await-in-loop
            await navigator.share({ files: [file], text: caption });
          }
        }
      }
      setSelectMode(false);
      setSelectedIds(new Set());
    } catch (err) {
      if (err?.name !== "AbortError") alert("Could not share the selected photos.");
    } finally {
      setSharingSelected(false);
    }
  }

  const pendingCount = parcels.filter((p) => !p.billedBillIds?.length).length;
  const billedCount = parcels.length - pendingCount;

  // Group by customer, most recently active customer first.
  const groupMap = new Map();
  for (const p of parcels) {
    const key = p.customerId || p.customerName;
    if (!groupMap.has(key)) {
      groupMap.set(key, { key, customerName: p.customerName, parcels: [] });
    }
    groupMap.get(key).parcels.push(p);
  }
  const customerGroups = Array.from(groupMap.values()).sort(
    (a, b) => new Date(b.parcels[0].createdAt) - new Date(a.parcels[0].createdAt)
  );

  return (
    <div className="min-h-dvh bg-ink-50 pb-28">
      <header className="flex items-center justify-between bg-white px-5 pb-4 pt-6 shadow-card">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Parcels</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {pendingCount} pending · {billedCount} billed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSelectMode}
            className={`h-10 rounded-full px-3.5 text-sm font-semibold transition-colors ${
              selectMode ? "bg-ink-900 text-white" : "bg-ink-50 text-ink-600"
            }`}
          >
            {selectMode ? "Cancel" : "Select"}
          </button>
          <button
            onClick={() => setShowCapture(true)}
            className="flex h-10 items-center gap-1.5 rounded-full bg-brand-500 px-4 text-sm font-semibold text-white shadow-card active:scale-95"
          >
            <PlusIcon width={18} height={18} /> Photo
          </button>
        </div>
      </header>

      <main className="px-5 pt-4">
        {error && (
          <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load parcels: {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-white shadow-card" />
            ))}
          </div>
        ) : parcels.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <PackageIcon width={26} height={26} />
            </div>
            <p className="mt-4 text-[15px] font-semibold text-ink-800">
              No parcels yet
            </p>
            <p className="mt-1 max-w-[220px] text-sm text-ink-500">
              Tap "Photo" to snap a parcel and tag it to a customer.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {customerGroups.map((group) => {
              const isOpen = openCustomer === group.key || selectMode;
              const groupPending = group.parcels.filter((p) => !p.billedBillIds?.length).length;
              return (
                <section
                  key={group.key}
                  className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card"
                >
                  <button
                    onClick={() => setOpenCustomer(isOpen && !selectMode ? null : group.key)}
                    className="flex w-full items-center justify-between px-4 py-3.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-ink-900">
                        {group.customerName}
                      </span>
                      <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs font-semibold text-ink-500">
                        {group.parcels.length}
                      </span>
                      {groupPending > 0 && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          {groupPending} pending
                        </span>
                      )}
                    </div>
                    <ChevronDownIcon
                      width={18}
                      height={18}
                      className={`text-ink-300 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="border-t border-ink-100 p-3">
                      <ParcelGrid
                        parcels={group.parcels}
                        selectMode={selectMode}
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelected}
                        onShare={handleShareOne}
                        onDelete={handleDelete}
                      />
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      {selectMode && selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <button
            onClick={handleShareSelected}
            disabled={sharingSelected}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-base font-semibold text-white shadow-pop active:scale-[0.98] disabled:opacity-60"
          >
            <ShareIcon width={18} height={18} />
            {sharingSelected ? "Preparing…" : `Share Selected (${selectedIds.size})`}
          </button>
        </div>
      )}

      {showCapture && (
        <CaptureSheet
          customers={customers}
          onClose={() => setShowCapture(false)}
          onSaved={loadParcels}
        />
      )}
    </div>
  );
}

function ParcelGrid({ parcels, selectMode, selectedIds, onToggleSelect, onShare, onDelete }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {parcels.map((p) => {
        const isBilled = !!p.billedBillIds?.length;
        return (
          <div
            key={p._id}
            onClick={() => selectMode && onToggleSelect(p._id)}
            className={`overflow-hidden rounded-2xl border bg-white shadow-card ${
              selectMode ? "cursor-pointer" : ""
            } ${
              selectMode && selectedIds.has(p._id)
                ? "border-brand-400 ring-2 ring-brand-200"
                : "border-ink-100"
            }`}
          >
            <div className="relative aspect-square w-full bg-ink-50">
              <img
                src={p.imageUrl}
                alt={p.note}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {selectMode && (
                <div
                  className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                    selectedIds.has(p._id)
                      ? "border-brand-500 bg-brand-500 text-white"
                      : "border-white bg-black/20 text-transparent"
                  }`}
                >
                  <CheckIcon width={14} height={14} />
                </div>
              )}
              <span className="absolute left-2 top-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-extrabold text-white shadow">
                {p.dNumber}
              </span>
              {isBilled && (
                <span className="absolute bottom-2 left-2 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                  Billed
                </span>
              )}
            </div>
            <div className="p-2.5">
              <p className="truncate text-[13px] font-semibold text-ink-900">
                {p.customerName}
              </p>
              <p className="truncate text-xs text-ink-500">{p.note}</p>
              <p className="mt-0.5 text-[10px] text-ink-400">
                {formatDateTime(p.createdAt)}
              </p>
              {!selectMode && (
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShare(p);
                    }}
                    className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-brand-50 text-xs font-semibold text-brand-700 active:scale-95"
                  >
                    <ShareIcon width={13} height={13} /> Share
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(p._id);
                    }}
                    aria-label="Delete parcel"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 active:bg-red-50 active:text-red-600"
                  >
                    <TrashIcon width={14} height={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CaptureSheet({ customers, onClose, onSaved }) {
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [dataUrl, setDataUrl] = useState(null);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(null); // { parcel, file }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await fileToCompressedDataUrl(file);
      setDataUrl(compressed);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleSelectCustomer(id) {
    setCustomerId(id);
    const c = customers.find((x) => x._id === id);
    if (c) {
      setCustomerName(c.name);
      setCustomerPhone(c.phone || "");
    }
  }

  async function handleSave() {
    if (!dataUrl) return setError("Please take or choose a photo.");
    if (!customerId) return setError("Please select a customer.");
    if (!note.trim()) return setError("Please add a note (phone model / variant).");

    setSaving(true);
    setError("");
    try {
      const parcel = await store.createParcel({
        customerId,
        customerName,
        customerPhone,
        note: note.trim(),
        image: dataUrl,
      });
      const file = dataUrlToFile(dataUrl, `${parcel.dNumber}.jpg`);
      setSaved({ parcel, file });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleShareSaved() {
    if (!saved) return;
    const { parcel, file } = saved;
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: parcel.dNumber,
          text: captionFor(parcel),
        });
      } else if (navigator.share) {
        await navigator.share({ title: parcel.dNumber, text: captionFor(parcel) });
      } else {
        alert("Sharing isn't supported in this browser.");
      }
    } catch (err) {
      if (err?.name !== "AbortError") alert("Could not open the share sheet.");
    }
  }

  function handleAddAnother() {
    setDataUrl(null);
    setCustomerId("");
    setCustomerName("");
    setCustomerPhone("");
    setNote("");
    setSaved(null);
    setError("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-pop">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">
            {saved ? "Saved" : "New Parcel Photo"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-50 text-ink-500"
          >
            <XIcon width={18} height={18} />
          </button>
        </div>

        {saved ? (
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
              <CheckCircleIcon width={32} height={32} />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-blue-600">
              {saved.parcel.dNumber}
            </p>
            <p className="mt-1 text-sm text-ink-600">
              {saved.parcel.customerName} · {saved.parcel.note}
            </p>

            <div className="mt-5 w-full space-y-2.5">
              <button
                onClick={handleShareSaved}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-base font-semibold text-white shadow-card active:scale-[0.98]"
              >
                <ShareIcon width={18} height={18} /> Share to WhatsApp
              </button>
              <button
                onClick={handleAddAnother}
                className="flex h-12 w-full items-center justify-center rounded-xl border border-ink-200 text-base font-semibold text-ink-700 active:scale-[0.98]"
              >
                Add Another Photo
              </button>
              <button
                onClick={onClose}
                className="flex h-11 w-full items-center justify-center text-sm font-semibold text-ink-400"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {dataUrl ? (
              <div className="relative overflow-hidden rounded-2xl border border-ink-100">
                <img src={dataUrl} alt="Parcel preview" className="max-h-64 w-full object-cover" />
                <div className="absolute bottom-2 right-2 flex gap-1.5">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Retake
                  </button>
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Choose Different
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50 text-ink-400"
                >
                  <CameraIcon width={28} height={28} />
                  <span className="text-xs font-medium">Take Photo</span>
                </button>
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50 text-ink-400"
                >
                  <ImageUploadIcon width={28} height={28} />
                  <span className="text-xs font-medium">Upload Image</span>
                </button>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">
                Customer
              </label>
              <select
                value={customerId}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="h-12 w-full rounded-xl border border-ink-200 bg-white px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </option>
                ))}
              </select>
              {customers.length === 0 && (
                <p className="mt-1.5 text-xs text-ink-400">
                  No customers yet — add one from the Customers tab first.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">
                Note (phone model / variant)
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. iPhone 17 256"
                className="h-12 w-full rounded-xl border border-ink-200 px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-500 text-base font-semibold text-white shadow-card active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Parcel"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
