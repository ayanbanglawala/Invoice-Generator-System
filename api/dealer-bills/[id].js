import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import DealerBill from "../../server/models/DealerBill.js";
import Parcel from "../../server/models/Parcel.js";
import { applyDealerBillUpdate } from "../../server/lib/dealerBillUpdate.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();
  const { id } = req.query;

  if (req.method === "GET") {
    const bill = await DealerBill.findById(id);
    if (!bill) return res.status(404).json({ error: "Dealer bill not found." });
    return res.status(200).json(bill);
  }

  // Handles three things independently (see applyDealerBillUpdate):
  // adding/removing parcels (`parcelIds`), editing price/qty per item
  // (`items`), and editing `note`/`billNo`.
  if (req.method === "PUT") {
    try {
      const bill = await DealerBill.findById(id);
      if (!bill) return res.status(404).json({ error: "Dealer bill not found." });

      await applyDealerBillUpdate(bill, req.body || {});
      await bill.save();

      return res.status(200).json(bill);
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
  }

  if (req.method === "DELETE") {
    await Parcel.updateMany({ dealerBillId: id }, { $set: { dealerBillId: null } });
    await DealerBill.findByIdAndDelete(id);
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
