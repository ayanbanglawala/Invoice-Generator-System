import { forwardRef } from "react";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const DealerManifestTemplate = forwardRef(function DealerManifestTemplate(
  { business, dealerBill },
  ref
) {
  const items = dealerBill.items || [];
  const totalPieces = items.reduce((s, i) => s + Number(i.qty || 0), 0);

  return (
    <div
      ref={ref}
      className="invoice-surface mx-auto overflow-hidden rounded-2xl border border-ink-100"
    >
      <div className="h-10 bg-indigo-500" />

      <div className="px-6 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-ink-900">{business.name}</h1>
            <p className="mt-1 text-[13px] leading-snug text-ink-500">
              {business.address}
            </p>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xl font-bold text-white">
            {business.logoInitial || business.name?.[0] || "B"}
          </div>
        </div>

        <div className="mt-5 flex items-start justify-between border-t border-ink-100 pt-4">
          <div>
            <p className="text-[13px] font-semibold text-indigo-600">
              Dealer Packing List
            </p>
            <p className="text-[13px] font-medium text-ink-800">
              {totalPieces} piece{totalPieces === 1 ? "" : "s"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-semibold text-indigo-600">Date</p>
            <p className="text-[13px] font-semibold text-ink-900">
              {formatDate(dealerBill.createdAt)}
            </p>
            {dealerBill.billNo && (
              <p className="mt-1.5 text-lg font-extrabold leading-none text-indigo-600">
                {dealerBill.billNo}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 px-6">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-ink-200 text-ink-500">
              <th className="py-2 text-left font-semibold">D No.</th>
              <th className="py-2 text-left font-semibold">Model</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-ink-100 align-top">
                <td className="py-2.5 pr-2 font-semibold text-indigo-600">
                  {item.dNumber}
                </td>
                <td className="py-2.5 font-medium text-ink-800">{item.name}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t-2 border-ink-200 py-2.5 text-[15px] font-bold text-ink-900">
          <span>{totalPieces} Pieces Total</span>
        </div>
      </div>

      {dealerBill.note && (
        <div className="mx-6 mt-2 rounded-lg bg-ink-50 px-3 py-2 text-[12px] text-ink-600">
          {dealerBill.note}
        </div>
      )}

      <p className="px-6 pb-6 pt-4 text-[13px] text-ink-500">
        Handed over for {business.name}.
      </p>
    </div>
  );
});

export default DealerManifestTemplate;
