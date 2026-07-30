import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    sr: { type: String, trim: true, default: "" },
    name: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    billNo: { type: String, required: true, trim: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, trim: true, default: "" },
    dateOfIssue: { type: Date, required: true },
    items: { type: [itemSchema], required: true, validate: (v) => v.length > 0 },
    note: { type: String, trim: true, default: "" },
    totalAmount: { type: Number, required: true, default: 0 },
    // Derived, stored fields so we can group/sort by month cheaply without
    // recomputing on every read. Format: monthKey "2026-01", monthLabel "January 2026".
    monthKey: { type: String, required: true, index: true },
    monthLabel: { type: String, required: true },
  },
  { timestamps: true }
);

billSchema.index({ monthKey: -1, dateOfIssue: -1 });
billSchema.index({ billNo: 1 });

billSchema.pre("validate", function computeDerivedFields(next) {
  if (this.items?.length) {
    this.totalAmount = this.items.reduce(
      (sum, it) => sum + Number(it.qty || 0) * Number(it.price || 0),
      0
    );
  }
  if (this.dateOfIssue) {
    const d = new Date(this.dateOfIssue);
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    this.monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    this.monthLabel = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  }
  next();
});

export default mongoose.model("Bill", billSchema);
