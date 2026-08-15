import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as store from "../lib/storage";
import DealerManifestTemplate from "../components/DealerManifestTemplate";
import InvoiceTemplate from "../components/InvoiceTemplate";
import { DownloadIcon, ShareIcon, ChevronRightIcon, TrashIcon } from "../components/Icons";

export default function DealerBillView() {
  const { id } = useParams();
  const business = store.getBusiness();
  const templateRef = useRef(null);

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  function load() {
    setLoading(true);
    return store
      .getDealerBill(id)
      .then((data) => {
        setBill(data);
        setLoadError("");
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
      </div>
    );
  }

  if (loadError || !bill) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ink-50 px-6 text-center">
        <p className="text-base font-semibold text-ink-800">
          {loadError ? "Could not load this dealer bill" : "Dealer bill not found"}
        </p>
        {loadError && <p className="text-sm text-ink-500">{loadError}</p>}
        <Link
          to="/dealer-bills"
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to Dealer Bills
        </Link>
      </div>
    );
  }

  async function captureCanvas() {
    return html2canvas(templateRef.current, {
      scale: 2.5,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
  }

  async function buildPdf() {
    const canvas = await captureCanvas();
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgRatio = canvas.width / canvas.height;
    let renderWidth = pageWidth - 48;
    let renderHeight = renderWidth / imgRatio;
    if (renderHeight > pageHeight - 48) {
      renderHeight = pageHeight - 48;
      renderWidth = renderHeight * imgRatio;
    }
    const x = (pageWidth - renderWidth) / 2;
    pdf.addImage(imgData, "PNG", x, 24, renderWidth, renderHeight);
    return pdf;
  }

  function fileBase() {
    const kind = bill.status === "priced" ? "Invoice" : "Packing-List";
    return `${kind}-${bill.billNo}`.replace(/\s+/g, "_");
  }

  async function handleDownloadJpg() {
    setBusy(true);
    try {
      const canvas = await captureCanvas();
      const link = document.createElement("a");
      link.download = `${fileBase()}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
    } catch {
      alert("Could not generate the image. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadPdf() {
    setBusy(true);
    try {
      const pdf = await buildPdf();
      pdf.save(`${fileBase()}.pdf`);
    } catch {
      alert("Could not generate the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    setBusy(true);
    try {
      const pdf = await buildPdf();
      const blob = pdf.output("blob");
      const fileName = `${fileBase()}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });
      const canShareFile =
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      const text =
        bill.status === "priced"
          ? `Dealer Invoice ${bill.billNo} — ₹${bill.totalAmount.toLocaleString("en-IN")}`
          : `${bill.billNo}\n${bill.items.map((it) => `${it.dNumber} — ${it.name}`).join("\n")}\n${bill.totalPieces} Pieces Total`;

      if (canShareFile) {
        await navigator.share({ files: [file], title: bill.billNo, text });
      } else {
        pdf.save(fileName);
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
      try {
        const pdf = await buildPdf();
        pdf.save(`${fileBase()}.pdf`);
      } catch {
        alert("Could not generate the PDF. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this dealer bill? Its photos will become available for a new bundle again.")) {
      return;
    }
    try {
      await store.deleteDealerBill(bill._id);
      window.location.href = "/dealer-bills";
    } catch (err) {
      alert(err.message);
    }
  }

  const invoiceViewBill = {
    billNo: bill.billNo,
    customerName: "Dealer",
    dateOfIssue: bill.updatedAt,
    items: bill.items.map((it) => ({
      sr: it.dNumber,
      name: it.name,
      qty: it.qty,
      price: it.price,
    })),
    note: bill.note,
  };

  return (
    <div className="min-h-dvh bg-ink-50 pb-32">
      <header className="bg-white px-5 pb-4 pt-6 shadow-card">
        <div className="flex items-center gap-1 text-sm text-ink-400">
          <Link to="/dealer-bills" className="hover:text-ink-600">
            Dealer Bills
          </Link>
          <ChevronRightIcon width={14} height={14} />
          <span className="text-ink-600">{bill.billNo}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-indigo-600">{bill.billNo}</h1>
            <p className="mt-0.5 text-sm text-ink-500">
              {bill.totalPieces} pieces ·{" "}
              {bill.status === "priced" ? "Priced" : "Awaiting price"}
            </p>
          </div>
          <button
            onClick={handleDelete}
            aria-label="Delete dealer bill"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-50 text-ink-400 transition-colors active:bg-red-50 active:text-red-600"
          >
            <TrashIcon width={19} height={19} />
          </button>
        </div>
      </header>

      <main className="px-5 pt-5">
        {editing ? (
          <PricingForm
            bill={bill}
            onCancel={() => setEditing(false)}
            onSaved={(updated) => {
              setBill(updated);
              setEditing(false);
            }}
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl bg-ink-100/50 p-4">
              {bill.status === "priced" ? (
                <InvoiceTemplate ref={templateRef} business={business} bill={invoiceViewBill} />
              ) : (
                <DealerManifestTemplate ref={templateRef} business={business} dealerBill={bill} />
              )}
            </div>

            <button
              onClick={() => setEditing(true)}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-sm font-semibold text-indigo-700 active:scale-[0.98]"
            >
              {bill.status === "priced" ? "Edit Prices" : "Add Prices"}
            </button>
          </>
        )}
      </main>

      {!editing && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <div className="mx-auto flex max-w-md gap-2">
            <button
              onClick={handleDownloadJpg}
              disabled={busy}
              className="flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-ink-200 bg-white text-xs font-semibold text-ink-700 active:scale-[0.98] disabled:opacity-60"
            >
              <DownloadIcon width={17} height={17} />
              JPG
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={busy}
              className="flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-ink-200 bg-white text-xs font-semibold text-ink-700 active:scale-[0.98] disabled:opacity-60"
            >
              <DownloadIcon width={17} height={17} />
              PDF
            </button>
            <button
              onClick={handleShare}
              disabled={busy}
              className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-card active:scale-[0.98] disabled:opacity-60"
            >
              <ShareIcon width={18} height={18} />
              {busy ? "Working…" : "Share"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PricingForm({ bill, onCancel, onSaved }) {
  const [billNo, setBillNo] = useState(bill.billNo);
  const [note, setNote] = useState(bill.note || "");
  const [prices, setPrices] = useState(
    Object.fromEntries(bill.items.map((it) => [it.parcelId, it.price || ""]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = bill.items.reduce(
    (s, it) => s + Number(it.qty || 1) * Number(prices[it.parcelId] || 0),
    0
  );

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const items = bill.items.map((it) => ({
        parcelId: it.parcelId,
        price: Number(prices[it.parcelId] || 0),
        qty: it.qty,
      }));
      const updated = await store.priceDealerBill(bill._id, { billNo, note, items });
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
        <label className="mb-1.5 block text-sm font-semibold text-ink-700">
          Bill Number
        </label>
        <input
          value={billNo}
          onChange={(e) => setBillNo(e.target.value)}
          className="h-12 w-full rounded-xl border border-ink-200 px-4 text-base outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-ink-700">
          Enter price per piece
        </h2>
        <div className="space-y-3">
          {bill.items.map((it) => (
            <div
              key={it.parcelId}
              className="flex items-center gap-3 rounded-xl border border-ink-100 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-blue-600">{it.dNumber}</p>
                <p className="truncate text-xs text-ink-600">{it.name}</p>
              </div>
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={prices[it.parcelId]}
                onChange={(e) =>
                  setPrices((prev) => ({ ...prev, [it.parcelId]: e.target.value }))
                }
                placeholder="Price"
                className="h-11 w-28 rounded-lg border border-ink-200 px-3 text-right text-sm tabular-nums outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3 text-base font-bold text-ink-900">
          <span>Total</span>
          <span className="tabular-nums">₹{total.toLocaleString("en-IN")}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
        <label className="mb-1.5 block text-sm font-semibold text-ink-700">
          Note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-ink-200 px-4 py-3 text-base outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {error && (
        <p role="alert" className="px-1 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2 pb-4">
        <button
          onClick={onCancel}
          className="h-12 flex-1 rounded-xl border border-ink-200 text-sm font-semibold text-ink-700 active:scale-[0.98]"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-12 flex-[2] rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-card active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save & Generate Invoice"}
        </button>
      </div>
    </div>
  );
}
