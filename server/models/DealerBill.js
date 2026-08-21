import mongoose from "mongoose";

const dealerItemSchema = new mongoose.Schema(
  {
    parcelId: { type: mongoose.Schema.Types.ObjectId, ref: "Parcel", required: true },
    // Denormalized so the bundle still reads correctly even if the parcel
    // is later deleted from the Parcels tab.
    dNumber: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    // Denormalized from Parcel.customerName at the time the piece is packed,
    // so the dealer bundle can be grouped/displayed by owner even if the
    // parcel is later edited or deleted.
    ownerName: { type: String, trim: true, default: "" },
    qty: { type: Number, required: true, default: 1, min: 1 },
    price: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false }
);

const dealerBillSchema = new mongoose.Schema(
  {
    // The "A:xxx" number — entered manually, same free-text convention as
    // the customer Bill.billNo.
    billNo: { type: String, required: true, trim: true },
    note: { type: String, trim: true, default: "" },
    items: { type: [dealerItemSchema], required: true, validate: (v) => v.length > 0 },
    // "packed" = just bundled, no prices yet (this is the manifest stage
    // sent to the dealer to say "these pieces went out"). "priced" = you've
    // gone back in and entered what you're actually billing the dealer for.
    status: { type: String, enum: ["packed", "priced"], default: "packed" },
    totalPieces: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

dealerBillSchema.pre("validate", function computeTotals() {
  if (this.items?.length) {
    this.totalPieces = this.items.reduce((sum, it) => sum + Number(it.qty || 0), 0);
    this.totalAmount = this.items.reduce(
      (sum, it) => sum + Number(it.qty || 0) * Number(it.price || 0),
      0
    );
  }
});

dealerBillSchema.index({ createdAt: -1 });
// Powers the "awaiting price" count on the Dealer tab header and any
// status-based filtering there.
dealerBillSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("DealerBill", dealerBillSchema);
