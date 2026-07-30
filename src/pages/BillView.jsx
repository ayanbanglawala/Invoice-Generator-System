import { useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import * as store from "../lib/storage";
import InvoiceTemplate from "../components/InvoiceTemplate";
import { DownloadIcon, ShareIcon, TrashIcon, ChevronRightIcon } from "../components/Icons";

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function BillView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const bill = store.getBill(id);
  const business = store.getBusiness();
  const invoiceRef = useRef(null);
  const [busy, setBusy] = useState(false);

  if (!bill) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ink-50 px-6 text-center">
        <p className="text-base font-semibold text-ink-800">
          Bill not found
        </p>
        <Link
          to="/"
          className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to Bills
        </Link>
      </div>
    );
  }

  async function buildPdf() {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const node = invoiceRef.current;
    const canvas = await html2canvas(node, {
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
    const imgData = canvas.toDataURL("image/png");

    // Convert the captured pixel canvas into an A4-proportioned PDF page,
    // centered, so it prints cleanly instead of being pixel-for-pixel forced.
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
    const y = 24;

    pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);
    return pdf;
  }

  async function handleDownload() {
    setBusy(true);
    try {
      const pdf = await buildPdf();
      pdf.save(`Invoice-${bill.orderId}-${bill.customerName}.pdf`);
    } catch (err) {
      console.error(err);
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
      const fileName = `Invoice-${bill.orderId}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Invoice ${bill.orderId}`,
          text: `Invoice for ${bill.customerName} — ₹${totalAmount().toLocaleString(
            "en-IN"
          )}`,
        });
      } else {
        pdf.save(fileName);
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error(err);
        alert("Could not share the PDF. It has been downloaded instead.");
      }
    } finally {
      setBusy(false);
    }
  }

  function totalAmount() {
    return store.computeTotals(bill.items || []).totalAmount;
  }

  function handleDelete() {
    if (!confirm("Delete this bill permanently?")) return;
    store.deleteBill(bill.id);
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-dvh bg-ink-50 pb-32">
      <header className="bg-white px-5 pb-4 pt-6 shadow-card">
        <div className="flex items-center gap-1 text-sm text-ink-400">
          <Link to="/" className="hover:text-ink-600">
            Bills
          </Link>
          <ChevronRightIcon width={14} height={14} />
          <span className="text-ink-600">{bill.orderId}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink-900">
              {bill.customerName}
            </h1>
            <p className="mt-0.5 text-sm text-ink-500">
              {bill.orderId} · {formatDate(bill.dateOfIssue)}
            </p>
          </div>
          <button
            onClick={handleDelete}
            aria-label="Delete bill"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-50 text-ink-400 transition-colors active:bg-red-50 active:text-red-600"
          >
            <TrashIcon width={19} height={19} />
          </button>
        </div>
      </header>

      <main className="px-5 pt-5">
        <div className="overflow-x-auto rounded-2xl bg-ink-100/50 p-4">
          <InvoiceTemplate ref={invoiceRef} business={business} bill={bill} />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mx-auto flex max-w-md gap-3">
          <button
            onClick={handleDownload}
            disabled={busy}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white text-sm font-semibold text-ink-700 active:scale-[0.98] disabled:opacity-60"
          >
            <DownloadIcon width={18} height={18} />
            {busy ? "Working…" : "Download PDF"}
          </button>
          <button
            onClick={handleShare}
            disabled={busy}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-semibold text-white shadow-card active:scale-[0.98] disabled:opacity-60"
          >
            <ShareIcon width={18} height={18} />
            {busy ? "Working…" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}
