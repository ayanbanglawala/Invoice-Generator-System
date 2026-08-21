import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import Bill from "../../server/models/Bill.js";
import Parcel from "../../server/models/Parcel.js";

async function linkParcelsToBill(items, billId) {
  const parcelIds = items.map((it) => it.parcelId).filter(Boolean);
  if (parcelIds.length === 0) return;
  await Parcel.updateMany(
    { _id: { $in: parcelIds } },
    { $addToSet: { billedBillIds: billId } }
  );
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  if (req.method === "GET") {
    const { page, limit, customerId, customerName, q } = req.query;
    const filter = {};
    if (customerId && customerName) {
      filter.$or = [{ customerId }, { customerName }];
    } else if (customerId) {
      filter.customerId = customerId;
    }
    if (q && q.trim()) {
      const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ customerName: rx }, { billNo: rx }];
    }

    if (page || limit) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const bills = await Bill.find(filter)
        .sort({ dateOfIssue: -1, createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum + 1);
      const hasMore = bills.length > limitNum;
      return res.status(200).json({ bills: bills.slice(0, limitNum), page: pageNum, hasMore });
    }

    const bills = await Bill.find(filter).sort({ dateOfIssue: -1, createdAt: -1 });
    return res.status(200).json(bills);
  }

  if (req.method === "POST") {
    try {
      const { billNo, customerId, customerName, customerPhone, dateOfIssue, items, note } =
        req.body || {};

      if (!billNo || !billNo.trim()) {
        return res.status(400).json({ error: "Bill number is required." });
      }
      if (!customerName || !customerName.trim()) {
        return res.status(400).json({ error: "Customer is required." });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "At least one item is required." });
      }

      const bill = await Bill.create({
        billNo: billNo.trim(),
        customerId: customerId || null,
        customerName: customerName.trim(),
        customerPhone: (customerPhone || "").trim(),
        dateOfIssue: new Date(dateOfIssue),
        items,
        note: (note || "").trim(),
      });

      await linkParcelsToBill(items, bill._id);

      return res.status(201).json(bill);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
