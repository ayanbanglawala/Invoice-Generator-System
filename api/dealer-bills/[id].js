import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import DealerBill from "../../server/models/DealerBill.js";
import Parcel from "../../server/models/Parcel.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();
  const { id } = req.query;

  if (req.method === "GET") {
    const bill = await DealerBill.findById(id);
    if (!bill) return res.status(404).json({ error: "Dealer bill not found." });
    return res.status(200).json(bill);
  }

  // Used to add/edit prices (and optionally qty) per item, then flip status
  // from "packed" -> "priced" once done.
  if (req.method === "PUT") {
    try {
      const { items, note, billNo } = req.body || {};
      const bill = await DealerBill.findById(id);
      if (!bill) return res.status(404).json({ error: "Dealer bill not found." });

      if (Array.isArray(items)) {
        const priceById = new Map(items.map((it) => [it.parcelId, it]));
        bill.items = bill.items.map((existing) => {
          const incoming = priceById.get(String(existing.parcelId));
          if (!incoming) return existing;
          return {
            ...existing.toObject(),
            price: Number(incoming.price) || 0,
            qty: Number(incoming.qty) > 0 ? Number(incoming.qty) : 1,
          };
        });
      }
      if (typeof note === "string") bill.note = note.trim();
      if (typeof billNo === "string" && billNo.trim()) bill.billNo = billNo.trim();
      bill.status = "priced";

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
