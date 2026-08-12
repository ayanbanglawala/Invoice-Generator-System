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
    // A parcel can end up in more than one bill (e.g. customer bill, then a
    // separate dealer bill reusing the same photo) — so this is a list, not
    // a single flag. "Pending" = empty array. "Billed" = non-empty.
    billedBillIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bill", default: [] }],
  },
  { timestamps: true }
);

parcelSchema.index({ createdAt: -1 });

export default mongoose.model("Parcel", parcelSchema);
