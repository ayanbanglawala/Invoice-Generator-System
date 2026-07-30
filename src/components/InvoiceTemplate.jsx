import { forwardRef } from "react";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function money(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const InvoiceTemplate = forwardRef(function InvoiceTemplate(
  { business, bill },
  ref
) {
  const items = bill.items || [];
  const totalQty = items.reduce((s, i) => s + Number(i.qty || 0), 0);
  const totalAmount = items.reduce(
    (s, i) => s + Number(i.qty || 0) * Number(i.price || 0),
    0
  );

  return (
    <div
      ref={ref}
      className="invoice-surface mx-auto overflow-hidden rounded-2xl border border-ink-100"
    >
      {/* header bar */}
      <div className="h-10 bg-brand-400" />

      <div className="px-6 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-ink-900">
              {business.name}
            </h1>
            <p className="mt-1 text-[13px] leading-snug text-ink-500">
              {business.address}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-brand-600">
              <PhoneIcon /> {business.phone}
            </p>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xl font-bold text-white">
            {business.logoInitial || business.name?.[0] || "B"}
          </div>
        </div>

        <div className="mt-5 flex items-start justify-between border-t border-ink-100 pt-4">
          <div>
            <p className="text-[13px] font-semibold text-brand-600">
              Bill From:
            </p>
            <p className="text-[13px] font-medium text-ink-800">
              {bill.customerName}
            </p>
            {bill.customerPhone && (
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-500">
                <PhoneIcon small /> {bill.customerPhone}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[13px] font-semibold text-brand-600">
              Date of Issue
            </p>
            <p className="text-[13px] font-semibold text-ink-900">
              {formatDate(bill.dateOfIssue)}
            </p>
            {bill.orderId && (
              <p className="mt-1 text-[11px] font-medium text-ink-400">
                {bill.orderId}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 px-6">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-ink-200 text-ink-500">
              <th className="w-8 py-2 text-left font-semibold">SR</th>
              <th className="py-2 text-left font-semibold">Model</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Price</th>
              <th className="py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-ink-100 align-top">
                <td className="py-2.5 text-ink-500">{idx + 1}</td>
                <td className="py-2.5 pr-2 font-medium text-ink-800">
                  {item.name}
                </td>
                <td className="py-2.5 text-right tabular-nums text-ink-700">
                  {Number(item.qty || 0)}
                </td>
                <td className="py-2.5 text-right tabular-nums text-ink-700">
                  {money(item.price)}
                </td>
                <td className="py-2.5 text-right tabular-nums font-medium text-ink-900">
                  {money(Number(item.qty || 0) * Number(item.price || 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t-2 border-ink-200 py-2.5 text-[13px] font-semibold text-ink-900">
          <span>Total</span>
          <span className="tabular-nums">{totalQty}</span>
          <span className="tabular-nums">{money(totalAmount)}</span>
        </div>
      </div>

      <div className="mt-1 px-6">
        <div className="flex justify-between border-t border-ink-100 py-2 text-[15px] font-bold text-ink-900">
          <span>Grand Total</span>
          <span className="tabular-nums">₹{money(totalAmount)}</span>
        </div>
      </div>

      {bill.note && (
        <div className="mx-6 mt-2 rounded-lg bg-ink-50 px-3 py-2 text-[12px] text-ink-600">
          {bill.note}
        </div>
      )}

      <p className="px-6 pb-6 pt-4 text-[13px] text-ink-500">
        Thank you for doing business with us.
      </p>
    </div>
  );
});

function PhoneIcon({ small }) {
  const size = small ? 12 : 14;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export default InvoiceTemplate;
