import { Router } from "express";
import Bill from "../models/Bill.js";
import Parcel from "../models/Parcel.js";
import { parsePagination, pageResult, escapeRegex } from "../lib/pagination.js";

const router = Router();

async function linkParcelsToBill(items, billId) {
  const parcelIds = items.map((it) => it.parcelId).filter(Boolean);
  if (parcelIds.length === 0) return;
  await Parcel.updateMany(
    { _id: { $in: parcelIds } },
    { $addToSet: { billedBillIds: billId } }
  );
}

// GET /api/bills/grouped?page=&limit=
// Month summaries only (monthKey/monthLabel/count/totalAmount) — no bill
// documents are fetched here. The Dashboard lazy-loads a month's actual
// bills (10 at a time) only once that month's accordion row is opened,
// via GET /api/bills?monthKey=...&page=...
router.get("/grouped", async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 60 });

  const all = await Bill.aggregate([
    {
      $group: {
        _id: { monthKey: "$monthKey", monthLabel: "$monthLabel" },
        totalAmount: { $sum: "$totalAmount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.monthKey": -1 } },
    {
      $project: {
        _id: 0,
        monthKey: "$_id.monthKey",
        monthLabel: "$_id.monthLabel",
        totalAmount: 1,
        count: 1,
      },
    },
  ]);

  const total = all.length;
  const items = all.slice(skip, skip + limit);
  res.json(pageResult({ items, page, limit, total }));
});

// GET /api/bills
// Backward-compatible default (no query params at all): the full,
// unfiltered list, sorted newest first — used by screens that need every
// bill at once (e.g. Customer Ledger). Once any of monthKey/customerId/q/
// page is present, it switches to a paginated, filtered query — used by
// the Dashboard to lazy-load one month's bills, or to search across bills.
router.get("/", async (req, res) => {
  const { monthKey, customerId, q, page } = req.query;
  const usePagination = Boolean(monthKey || customerId || q || page);

  if (!usePagination) {
    const bills = await Bill.find().sort({ dateOfIssue: -1, createdAt: -1 });
    return res.json(bills);
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

  res.json(pageResult({ items, page: p, limit, total }));
});

// GET /api/bills/:id
router.get("/:id", async (req, res) => {
  const bill = await Bill.findById(req.params.id);
  if (!bill) return res.status(404).json({ error: "Bill not found." });
  res.json(bill);
});

// POST /api/bills
router.post("/", async (req, res) => {
  try {
    const { billNo, customerId, customerName, customerPhone, dateOfIssue, items, note } =
      req.body;

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

    res.status(201).json(bill);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/bills/:id
router.delete("/:id", async (req, res) => {
  await Bill.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

export default router;
