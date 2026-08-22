import { useEffect, useRef, useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import * as store from "../lib/storage";
import { useInfiniteList } from "../lib/useInfiniteList";
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

// The Parcels tab's status filter. Two independent real-world states
// (billed-to-customer, sent-to-dealer) collapsed into one dropdown for
// simplicity — see PROJECT_OVERVIEW.md section 2.1 for why they're kept
// as two separate tags in the first place.
const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending (not billed)" },
  { value: "billed", label: "Billed" },
  { value: "dealer", label: "Sent to dealer" },
  { value: "no-dealer", label: "Not sent to dealer" },
];

const GROUP_PAGE_SIZE = 10;
const ITEM_PAGE_SIZE = 10;

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
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCapture, setShowCapture] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  // Keeps the actual parcel objects for whatever is currently selected, so
  // Share/Delete/Send-to-Dealer can act on them without needing every
  // group to be loaded at once — a parcel only needs to have been *seen*
  // (its group opened) to be selectable.
  const [selectedParcels, setSelectedParcels] = useState(new Map());
  const [sharingSelected, setSharingSelected] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [showDealerModal, setShowDealerModal] = useState(false);
  const [openKey, setOpenKey] = useState(null);
  // Bumped after any mutation (delete, capture, dealer-bundle create) to
  // force every currently-loaded group's items to refetch from page 1.
  const [refreshTick, setRefreshTick] = useState(0);

  const {
    items: groups,
    loading,
    loadingMore: loadingMoreGroups,
    error,
    hasMore: hasMoreGroups,
    sentinelRef: groupsSentinelRef,
  } = useInfiniteList(
    (page) => store.getParcelGroups({ status: statusFilter, page, limit: GROUP_PAGE_SIZE }),
    [statusFilter, refreshTick]
  );

  useEffect(() => {
    store.getCustomers().then(setCustomers).catch(() => {});
  }, []);

  function bumpRefresh() {
    setOpenKey(null);
    setRefreshTick((v) => v + 1);
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
    setSelectedParcels(new Map());
  }

  const toggleSelected = useCallback((parcel) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(parcel._id)) next.delete(parcel._id);
      else next.add(parcel._id);
      return next;
    });
    setSelectedParcels((prev) => {
      const next = new Map(prev);
      if (next.has(parcel._id)) next.delete(parcel._id);
      else next.set(parcel._id, parcel);
      return next;
    });
  }, []);

  const handleDelete = useCallback((id) => {
    if (!confirm("Delete this parcel photo permanently?")) return;
    store
      .deleteParcel(id)
      .then(bumpRefresh)
      .catch((err) => alert(err.message));
  }, []);

  async function handleDeleteSelected() {
    const chosen = Array.from(selectedIds);
    if (chosen.length === 0) return;
    if (!confirm(`Delete ${chosen.length} selected photo${chosen.length === 1 ? "" : "s"} permanently?`)) {
      return;
    }
    setDeletingSelected(true);
    try {
      await Promise.all(chosen.map((id) => store.deleteParcel(id)));
      setSelectMode(false);
      setSelectedIds(new Set());
      setSelectedParcels(new Map());
      bumpRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingSelected(false);
    }
  }

  function handleOpenDealerModal() {
    const chosen = Array.from(selectedParcels.values());
    const eligible = chosen.filter((p) => !p.dealerBillId);
    const skipped = chosen.length - eligible.length;
    if (eligible.length === 0) {
      alert("All selected photos are already part of a dealer bundle. Pick different photos.");
      return;
    }
    if (skipped > 0) {
      alert(
        `${skipped} selected photo${skipped === 1 ? " is" : "s are"} already in another dealer bundle and will be skipped. Continuing with the other ${eligible.length}.`
      );
    }
    setShowDealerModal(true);
  }

  async function handleCreateDealerBundle({ series, note }) {
    const eligibleIds = Array.from(selectedParcels.values())
      .filter((p) => !p.dealerBillId)
      .map((p) => p._id);
    const dealerBill = await store.createDealerBill({
      series,
      note,
      parcelIds: eligibleIds,
    });
    setShowDealerModal(false);
    setSelectMode(false);
    setSelectedIds(new Set());
    setSelectedParcels(new Map());
    navigate(`/dealer-bills/${dealerBill._id}`);
  }

  const handleShareOne = useCallback(async (parcel) => {
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
  }, []);

  async function handleShareSelected() {
    const chosen = Array.from(selectedParcels.values());
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
      setSelectedParcels(new Map());
    } catch (err) {
      if (err?.name !== "AbortError") alert("Could not share the selected photos.");
    } finally {
      setSharingSelected(false);
    }
  }

  return (
    <div className="min-h-dvh bg-ink-50 dark:bg-ink-950 pb-28">
      <header className="bg-white dark:bg-ink-900 px-5 pb-4 pt-6 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink-900 dark:text-white">Parcels</h1>
            <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
              Grouped by customer · loaded as you scroll
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectMode}
              className={`h-10 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                selectMode ? "bg-ink-900 text-white" : "bg-ink-50 dark:bg-ink-950 text-ink-600 dark:text-ink-300"
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
        </div>

        {/* Status filter — reloads the customer list from the server,
            filtered, and collapses every open group back closed. */}
        <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === f.value
                  ? "bg-brand-500 text-white"
                  : "bg-ink-50 dark:bg-ink-950 text-ink-600 dark:text-ink-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <main className="px-5 pt-4">
        {error && (
          <div className="mb-3 rounded-xl border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            Could not load parcels: {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-white dark:bg-ink-900 shadow-card" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950 text-brand-500">
              <PackageIcon width={26} height={26} />
            </div>
            <p className="mt-4 text-[15px] font-semibold text-ink-800 dark:text-ink-100">
              {statusFilter === "all" ? "No parcels yet" : "No parcels match this filter"}
            </p>
            <p className="mt-1 max-w-[220px] text-sm text-ink-500 dark:text-ink-400">
              {statusFilter === "all"
                ? 'Tap "Photo" to snap a parcel and tag it to a customer.'
                : "Try a different status filter."}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {groups.map((group) => (
                <CustomerGroupSection
                  key={group.key}
                  group={group}
                  isOpen={openKey === group.key || selectMode}
                  onToggle={() => setOpenKey(openKey === group.key && !selectMode ? null : group.key)}
                  statusFilter={statusFilter}
                  refreshTick={refreshTick}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelected}
                  onShare={handleShareOne}
                  onDelete={handleDelete}
                />
              ))}
            </div>
            {/* Sentinel — loads the next 10 customer groups when it
                scrolls into view. */}
            <div ref={groupsSentinelRef} className="h-8" />
            {loadingMoreGroups && (
              <p className="py-3 text-center text-xs font-medium text-ink-400 dark:text-ink-500">
                Loading more customers…
              </p>
            )}
            {!hasMoreGroups && groups.length > 0 && (
              <p className="py-3 text-center text-xs text-ink-300 dark:text-ink-600">
                You've reached the end.
              </p>
            )}
          </>
        )}
      </main>

      {selectMode && selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 border-t border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-3 shadow-pop">
          <div className="mx-auto flex max-w-md gap-2">
            <button
              onClick={handleShareSelected}
              disabled={sharingSelected || deletingSelected}
              className="flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-xs font-semibold text-ink-700 dark:text-ink-200 active:scale-[0.98] disabled:opacity-60"
            >
              <ShareIcon width={16} height={16} />
              {sharingSelected ? "…" : "Share"}
            </button>
            <button
              onClick={handleOpenDealerModal}
              disabled={sharingSelected || deletingSelected}
              className="flex h-12 flex-[1.3] flex-col items-center justify-center gap-0.5 rounded-xl bg-indigo-600 text-xs font-semibold text-white shadow-card active:scale-[0.98] disabled:opacity-60"
            >
              <PackageIcon width={16} height={16} />
              Send to Dealer
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={sharingSelected || deletingSelected}
              className="flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950 text-xs font-semibold text-red-600 dark:text-red-400 active:scale-[0.98] disabled:opacity-60"
            >
              <TrashIcon width={16} height={16} />
              {deletingSelected ? "…" : "Delete"}
            </button>
          </div>
        </div>
      )}

      {showDealerModal && (
        <DealerBundleModal
          count={Array.from(selectedParcels.values()).filter((p) => !p.dealerBillId).length}
          onClose={() => setShowDealerModal(false)}
          onConfirm={handleCreateDealerBundle}
        />
      )}

      {showCapture && (
        <CaptureSheet
          customers={customers}
          onClose={() => setShowCapture(false)}
          onSaved={bumpRefresh}
        />
      )}
    </div>
  );
}

// One customer's accordion row. Only fetches that customer's parcels (10
// at a time) once it's opened for the first time — closing it keeps
// what's already loaded in memory so re-opening is instant, but nothing
// is fetched before the first open.
function CustomerGroupSection({
  group,
  isOpen,
  onToggle,
  statusFilter,
  refreshTick,
  selectMode,
  selectedIds,
  onToggleSelect,
  onShare,
  onDelete,
}) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0); // 0 = not loaded yet
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);

  const fetchPage = useCallback(
    (pageNum) =>
      store.getParcels({
        customerId: group.customerId || undefined,
        status: statusFilter,
        page: pageNum,
        limit: ITEM_PAGE_SIZE,
      }),
    [group.customerId, statusFilter]
  );

  // Load (or reload) page 1 the first time this group opens, and whenever
  // an outside mutation (delete/capture/dealer-bundle) bumps refreshTick.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    loadingRef.current = true;
    fetchPage(1)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items || []);
        setHasMore(!!res.hasMore);
        setPage(1);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        loadingRef.current = false;
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fetchPage, refreshTick]);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore || page === 0) return;
    loadingRef.current = true;
    setLoadingMore(true);
    const next = page + 1;
    fetchPage(next)
      .then((res) => {
        setItems((prev) => [...prev, ...(res.items || [])]);
        setHasMore(!!res.hasMore);
        setPage(next);
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setLoadingMore(false);
        loadingRef.current = false;
      });
  }, [fetchPage, hasMore, page]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const node = sentinelRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "150px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isOpen, loadMore]);

  return (
    <section className="overflow-hidden rounded-2xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold text-ink-900 dark:text-white">
            {group.customerName}
          </span>
          <span className="rounded-full bg-ink-50 dark:bg-ink-950 px-2 py-0.5 text-xs font-semibold text-ink-500 dark:text-ink-400">
            {group.totalCount}
          </span>
          {group.pendingCount > 0 && (
            <span className="rounded-full bg-amber-50 dark:bg-amber-950 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              {group.pendingCount} pending
            </span>
          )}
        </div>
        <ChevronDownIcon
          width={18}
          height={18}
          className={`text-ink-300 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-ink-100 dark:border-ink-800 p-3">
          {error && (
            <p className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
          )}
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-ink-50 dark:bg-ink-950" />
              ))}
            </div>
          ) : (
            <>
              <ParcelGrid
                parcels={items}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
                onShare={onShare}
                onDelete={onDelete}
              />
              {/* Sentinel — loads this customer's next 10 photos when it
                  scrolls into view. */}
              <div ref={sentinelRef} className="h-4" />
              {loadingMore && (
                <p className="py-2 text-center text-xs font-medium text-ink-400 dark:text-ink-500">
                  Loading more photos…
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function ParcelGrid({ parcels, selectMode, selectedIds, onToggleSelect, onShare, onDelete }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {parcels.map((p) => (
        <ParcelCard
          key={p._id}
          parcel={p}
          selectMode={selectMode}
          selected={selectedIds.has(p._id)}
          onToggleSelect={onToggleSelect}
          onShare={onShare}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

// Memoized so tapping one card to select it doesn't force React to
// re-render every other card in the grid (each of which has an <img> —
// on a list of dozens of parcels this was previously the single biggest
// source of jank when using select mode).
const ParcelCard = memo(function ParcelCard({
  parcel: p,
  selectMode,
  selected,
  onToggleSelect,
  onShare,
  onDelete,
}) {
  const billedNumbers = (p.billedBillIds || []).map((b) => b.billNo).filter(Boolean);
  const dealerNumber = p.dealerBillId?.billNo;
  return (
    <div
      onClick={() => selectMode && onToggleSelect(p)}
      className={`overflow-hidden rounded-2xl border bg-white dark:bg-ink-900 shadow-card ${
        selectMode ? "cursor-pointer" : ""
      } ${
        selectMode && selected
          ? "border-brand-400 ring-2 ring-brand-200"
          : "border-ink-100 dark:border-ink-800"
      }`}
    >
      <div className="relative aspect-square w-full bg-ink-50 dark:bg-ink-950">
        <img
          src={p.imageUrl}
          alt={p.note}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        {selectMode && (
          <div
            className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
              selected
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
        <div className="absolute bottom-2 left-2 flex flex-col items-start gap-1">
          {billedNumbers.length > 0 && (
            <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
              {billedNumbers.join(", ")}
            </span>
          )}
          {dealerNumber && (
            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
              {dealerNumber}
            </span>
          )}
        </div>
      </div>
      <div className="p-2.5">
        <p className="truncate text-[13px] font-semibold text-ink-900 dark:text-white">
          {p.customerName}
        </p>
        <p className="truncate text-xs text-ink-500 dark:text-ink-400">{p.note}</p>
        <p className="mt-0.5 text-[10px] text-ink-400 dark:text-ink-500">
          {formatDateTime(p.createdAt)}
        </p>
        {!selectMode && (
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShare(p);
              }}
              className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-brand-50 dark:bg-brand-950 text-xs font-semibold text-brand-700 dark:text-brand-300 active:scale-95"
            >
              <ShareIcon width={13} height={13} /> Share
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(p._id);
              }}
              aria-label="Delete parcel"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 dark:text-ink-500 active:bg-red-50 dark:bg-red-950 active:text-red-600 dark:text-red-400"
            >
              <TrashIcon width={14} height={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// Extend this list any time you want a new series available in the
// dropdown — the counter for a brand-new series starts fresh from :001
// automatically the first time it's used.
const DEALER_BILL_SERIES_OPTIONS = ["AZ", "G"];

function DealerBundleModal({ count, onClose, onConfirm }) {
  const [series, setSeries] = useState(DEALER_BILL_SERIES_OPTIONS[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onConfirm({ series, note: note.trim() });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-t-3xl bg-white dark:bg-ink-900 p-5 pb-8 shadow-pop"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900 dark:text-white">Send to Dealer</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-50 dark:bg-ink-950 text-ink-500 dark:text-ink-400"
          >
            <XIcon width={18} height={18} />
          </button>
        </div>

        <p className="mb-4 rounded-xl bg-indigo-50 dark:bg-indigo-950 px-3.5 py-2.5 text-sm font-medium text-indigo-800 dark:text-indigo-200">
          {count} photo{count === 1 ? "" : "s"} selected — will be bundled together.
          The bill number is generated automatically once you confirm.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
              Bill Series
            </label>
            <select
              value={series}
              onChange={(e) => setSeries(e.target.value)}
              className="h-12 w-full rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-4 text-base outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {DEALER_BILL_SERIES_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
              Description (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Any note for this batch"
              className="w-full rounded-xl border border-ink-200 dark:border-ink-700 px-4 py-3 text-base outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="h-12 w-full rounded-xl bg-indigo-600 text-base font-semibold text-white shadow-card active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create & Generate Manifest"}
          </button>
        </div>
      </form>
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
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white dark:bg-ink-900 p-5 pb-8 shadow-pop">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900 dark:text-white">
            {saved ? "Saved" : "New Parcel Photo"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-50 dark:bg-ink-950 text-ink-500 dark:text-ink-400"
          >
            <XIcon width={18} height={18} />
          </button>
        </div>

        {saved ? (
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400">
              <CheckCircleIcon width={32} height={32} />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-blue-600 dark:text-blue-400">
              {saved.parcel.dNumber}
            </p>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
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
                className="flex h-12 w-full items-center justify-center rounded-xl border border-ink-200 dark:border-ink-700 text-base font-semibold text-ink-700 dark:text-ink-200 active:scale-[0.98]"
              >
                Add Another Photo
              </button>
              <button
                onClick={onClose}
                className="flex h-11 w-full items-center justify-center text-sm font-semibold text-ink-400 dark:text-ink-500"
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
              <div className="relative overflow-hidden rounded-2xl border border-ink-100 dark:border-ink-800">
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
                  className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 text-ink-400 dark:text-ink-500"
                >
                  <CameraIcon width={28} height={28} />
                  <span className="text-xs font-medium">Take Photo</span>
                </button>
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 text-ink-400 dark:text-ink-500"
                >
                  <ImageUploadIcon width={28} height={28} />
                  <span className="text-xs font-medium">Upload Image</span>
                </button>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
                Customer
              </label>
              <select
                value={customerId}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="h-12 w-full rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
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
                <p className="mt-1.5 text-xs text-ink-400 dark:text-ink-500">
                  No customers yet — add one from the Customers tab first.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
                Note (phone model / variant)
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. iPhone 17 256"
                className="h-12 w-full rounded-xl border border-ink-200 dark:border-ink-700 px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
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
