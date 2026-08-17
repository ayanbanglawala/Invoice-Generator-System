function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${fmtDate(iso)} ${d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function parcelStatus(p) {
  const parts = [];
  if (p.billedBillIds?.length) parts.push("Billed to Customer");
  if (p.dealerBillId) parts.push("Sent to Dealer");
  return parts.length ? parts.join(" + ") : "Pending";
}

function sheetFromRows(rows, colWidths) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (colWidths) ws["!cols"] = colWidths.map((wch) => ({ wch }));
  return ws;
}

/**
 * Builds and downloads a .xlsx report covering everything that happened to
 * each phone: when it arrived (Parcels), who it was billed to and for how
 * much (Customer Bills), and what went to the dealer (Dealer Bills) — plus
 * a Summary sheet with totals for the range. All within [from, to].
 */
export async function downloadReportExcel({ parcels, bills, dealerBills }, { from, to } = {}) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // ---- Summary ----
  const pendingParcels = parcels.filter(
    (p) => !p.billedBillIds?.length && !p.dealerBillId
  ).length;
  const customerRevenue = bills.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const dealerRevenue = dealerBills
    .filter((d) => d.status === "priced")
    .reduce((s, d) => s + (d.totalAmount || 0), 0);
  const dealerPiecesOut = dealerBills.reduce((s, d) => s + (d.totalPieces || 0), 0);

  const summaryRows = [
    { Metric: "Date Range", Value: `${from || "Beginning"} to ${to || "Today"}` },
    { Metric: "Generated On", Value: fmtDateTime(new Date().toISOString()) },
    { Metric: "", Value: "" },
    { Metric: "Total Parcels Received", Value: parcels.length },
    { Metric: "Parcels Still Pending", Value: pendingParcels },
    { Metric: "", Value: "" },
    { Metric: "Customer Bills Created", Value: bills.length },
    { Metric: "Customer Revenue (Total)", Value: customerRevenue },
    { Metric: "", Value: "" },
    { Metric: "Dealer Bundles Created", Value: dealerBills.length },
    { Metric: "Dealer Pieces Sent Out", Value: dealerPiecesOut },
    { Metric: "Dealer Revenue (Priced Bundles Only)", Value: dealerRevenue },
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(summaryRows, [32, 22]), "Summary");

  // ---- Parcels: every phone that came in, and where it went ----
  const parcelRows = parcels.map((p) => ({
    "D No.": p.dNumber,
    "Date Received": fmtDate(p.createdAt),
    Customer: p.customerName,
    Phone: p.customerPhone || "",
    "Model / Variant": p.note,
    "Customer Bill No(s)": (p.billedBillIds || []).map((b) => b.billNo).join(", "),
    "Dealer Bill No": p.dealerBillId?.billNo || "",
    Status: parcelStatus(p),
  }));
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(parcelRows, [8, 14, 20, 14, 24, 18, 14, 22]),
    "Parcels"
  );

  // ---- Customer Bills: one row per line item, easy to scan/filter ----
  const billRows = [];
  for (const b of bills) {
    for (const it of b.items || []) {
      billRows.push({
        "Bill No": b.billNo,
        Date: fmtDate(b.dateOfIssue),
        Customer: b.customerName,
        "D No.": it.sr,
        Model: it.name,
        Qty: it.qty,
        Price: it.price,
        "Line Total": it.qty * it.price,
        "Bill Total": b.totalAmount,
      });
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(billRows, [14, 12, 20, 8, 22, 6, 10, 12, 12]),
    "Customer Bills"
  );

  // ---- Dealer Bills: one row per piece ----
  const dealerRows = [];
  for (const d of dealerBills) {
    for (const it of d.items || []) {
      dealerRows.push({
        "Bill No": d.billNo,
        Date: fmtDate(d.createdAt),
        Status: d.status === "priced" ? "Priced" : "Awaiting Price",
        "D No.": it.dNumber,
        Model: it.name,
        Qty: it.qty,
        Price: it.price,
        "Line Total": it.qty * it.price,
        "Bill Total": d.totalAmount,
        Note: d.note || "",
      });
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(dealerRows, [14, 12, 14, 8, 22, 6, 10, 12, 12, 24]),
    "Dealer Bills"
  );

  const rangeLabel = from || to ? `${from || "start"}_to_${to || "today"}` : "all";
  XLSX.writeFile(wb, `Report_${rangeLabel}.xlsx`);
}
