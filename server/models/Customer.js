import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

customerSchema.index({ name: 1 });

export default mongoose.model("Customer", customerSchema);
