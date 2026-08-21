import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import Parcel from "../../server/models/Parcel.js";
// eslint-disable-next-line no-unused-vars
import DealerBill from "../../server/models/DealerBill.js";

// GET /api/parcels/pending — only parcels that are dealer-priced but not
// yet billed to the customer. This is the exact subset the Home screen's
// "Pending Payments" section needs, so it no longer has to download every
// parcel ever created (which only grows over time) just to compute it.
export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parcels = await Parcel.find({
    dealerPrice: { $ne: null },
    $or: [{ billedBillIds: { $exists: false } }, { billedBillIds: { $size: 0 } }],
  })
    .sort({ createdAt: -1 })
    .populate("dealerBillId", "billNo status");
  return res.status(200).json(parcels);
}
