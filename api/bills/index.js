import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import Bill from "../../server/models/Bill.js";
import Parcel from "../../server/models/Parcel.js";
import { parsePagination, pageResult, escapeRegex } from "../../server/lib/pagination.js";

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
    const { monthKey, customerId, q, page } = req.query || {};
    const usePagination = Boolean(monthKey || customerId || q || page);

    if (!usePagination) {
      const bills = await Bill.find().sort({ dateOfIssue: -1, createdAt: -1 });
      return res.status(200).json(bills);
    }

    const match = {};
    if (monthKey) match.monthKey = monthKey;
    if (customerId) match.customerId = customerId;
    if (q && q.trim()) {
      const re = new RegExp(escapeRegex(q.trim()), "i");
      match.$or = [{ customerName: re }, { billNo: re }];
    }

    const { page: p, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 30 });
    const [items, total] = await Promise.all([
      Bill.find(match).sort({ dateOfIssue: -1, createdAt: -1 }).skip(skip).limit(limit),
      Bill.countDocuments(match),
    ]);

    return res.status(200).json(pageResult({ items, page: p, limit, total }));
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
