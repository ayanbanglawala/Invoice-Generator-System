import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
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
  const business = store.getBusiness();
  const invoiceRef = useRef(null);
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    store
      .getBill(id)
      .then((data) => !cancelled && setBill(data))
      .catch((err) => !cancelled && setLoadError(err.message))
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

  if (loadError || !bill) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ink-50 dark:bg-ink-950 px-6 text-center">
        <p className="text-base font-semibold text-ink-800 dark:text-ink-100">
          {loadError ? "Could not load this bill" : "Bill not found"}
        </p>
        {loadError && <p className="text-sm text-ink-500 dark:text-ink-400">{loadError}</p>}
        <Link
          to="/"
          className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to Bills
        </Link>
      </div>
    );
  }

  async function captureCanvas() {
    const node = invoiceRef.current;
    return html2canvas(node, {
      scale: 2.5,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
  }

  async function buildPdf() {
    const canvas = await captureCanvas();
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

  function fileBase() {
    return `Invoice-${bill.billNo || bill._id.slice(0, 6)}-${bill.customerName}`.replace(
      /\s+/g,
      "_"
    );
  }

  async function handleDownloadJpg() {
    setBusy(true);
    try {
      const canvas = await captureCanvas();
      const link = document.createElement("a");
      link.download = `${fileBase()}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
    } catch (err) {
      console.error(err);
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
      const fileName = `${fileBase()}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });
      const canShareFile =
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShareFile) {
        await navigator.share({
          files: [file],
          title: `Invoice ${bill.billNo}`,
          text: `Invoice for ${bill.customerName} — ₹${totalAmount().toLocaleString(
            "en-IN"
          )}`,
        });
      } else {
        pdf.save(fileName);
      }
    } catch (err) {
      // AbortError = user closed the share sheet, nothing to do.
      // NotAllowedError = iOS Safari decided too much time passed since the
      // tap to trust this as a real user action — just fall back quietly.
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

  function totalAmount() {
    return store.computeTotals(bill.items || []).totalAmount;
  }

  async function handleDelete() {
    if (!confirm("Delete this bill permanently?")) return;
    try {
      await store.deleteBill(bill._id);
      navigate("/", { replace: true });
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="min-h-dvh bg-ink-50 dark:bg-ink-950 pb-32">
      <header className="bg-white dark:bg-ink-900 px-5 pb-4 pt-6 shadow-card">
        <div className="flex items-center gap-1 text-sm text-ink-400 dark:text-ink-500">
          <Link to="/" className="hover:text-ink-600 dark:text-ink-300">
            Bills
          </Link>
          <ChevronRightIcon width={14} height={14} />
          <span className="text-ink-600 dark:text-ink-300">{bill.billNo}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink-900 dark:text-white">
              {bill.customerName}
            </h1>
            <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
              Bill No: {bill.billNo} · {formatDate(bill.dateOfIssue)}
            </p>
          </div>
          <button
            onClick={handleDelete}
            aria-label="Delete bill"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-50 dark:bg-ink-950 text-ink-400 dark:text-ink-500 transition-colors active:bg-red-50 dark:bg-red-950 active:text-red-600 dark:text-red-400"
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

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mx-auto flex max-w-md gap-2">
          <button
            onClick={handleDownloadJpg}
            disabled={busy}
            className="flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-xs font-semibold text-ink-700 dark:text-ink-200 active:scale-[0.98] disabled:opacity-60"
          >
            <DownloadIcon width={17} height={17} />
            JPG
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={busy}
            className="flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-xs font-semibold text-ink-700 dark:text-ink-200 active:scale-[0.98] disabled:opacity-60"
          >
            <DownloadIcon width={17} height={17} />
            PDF
          </button>
          <button
            onClick={handleShare}
            disabled={busy}
            className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-semibold text-white shadow-card active:scale-[0.98] disabled:opacity-60"
          >
            <ShareIcon width={18} height={18} />
            {busy ? "Working…" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}
