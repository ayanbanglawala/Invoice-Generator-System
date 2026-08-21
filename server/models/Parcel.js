import mongoose from "mongoose";

const parcelSchema = new mongoose.Schema(
  {
    // e.g. "D1", "D2" — unique, auto-generated, never reused.
    dNumber: { type: String, required: true, unique: true, trim: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, trim: true, default: "" },
    note: { type: String, required: true, trim: true }, // e.g. "iPhone 17 256"
    imageUrl: { type: String, required: true },
    // A parcel can end up in more than one *customer* bill (e.g. sold, then
    // referenced again for accounting) — so this is a list, not a flag.
    billedBillIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bill", default: [] }],
    // Dealer bundles are exclusive — once a parcel is packed into one dealer
    // bundle it can't be picked for another, so this is a single ref, not a list.
    dealerBillId: { type: mongoose.Schema.Types.ObjectId, ref: "DealerBill", default: null },
    // Copied over from the dealer bundle's item once it's priced (see
    // applyDealerBillUpdate). Lets the Home tab show "expected payment" for
    // parcels that have a known dealer price but no customer bill yet,
    // without joining through DealerBill.items on every page load.
    dealerPrice: { type: Number, default: null },
  },
  { timestamps: true }
);

parcelSchema.index({ createdAt: -1 });
// Powers: customer ledger lookups, "unbilled parcels" filtering in the
// Send-to-Dealer picker, and the Home pending-payments grouping — all of
// which previously scanned every parcel document to find matches.
parcelSchema.index({ customerId: 1 });
parcelSchema.index({ dealerBillId: 1 });
parcelSchema.index({ billedBillIds: 1 });

export default mongoose.model("Parcel", parcelSchema);
