// Builds the Mongo match clause for the Parcels tab's status filter.
// Kept as its own tiny module so both the Express route and the Vercel
// function apply the exact same definitions for each status.
//
//  - "pending"   : not yet billed to the end customer (billedBillIds empty)
//  - "billed"    : billed to the end customer at least once
//  - "dealer"    : already sent to a dealer bundle (dealerBillId set)
//  - "no-dealer" : not sent to any dealer bundle yet
//  - "all" / anything else: no filter
export function buildParcelStatusMatch(status) {
  switch (status) {
    case "pending":
      return {
        $or: [{ billedBillIds: { $exists: false } }, { billedBillIds: { $size: 0 } }],
      };
    case "billed":
      return { $expr: { $gt: [{ $size: { $ifNull: ["$billedBillIds", []] } }, 0] } };
    case "dealer":
      return { dealerBillId: { $ne: null } };
    case "no-dealer":
      return { dealerBillId: null };
    default:
      return null;
  }
}

export const PARCEL_STATUS_OPTIONS = ["all", "pending", "billed", "dealer", "no-dealer"];
