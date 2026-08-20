import { Router } from "express";
import Bill from "../models/Bill.js";
import Parcel from "../models/Parcel.js";
import { nextBillNumber } from "../lib/billCounter.js";

const router = Router();

async function linkParcelsToBill(items, billId) {
  const parcelIds = items.map((it) => it.parcelId).filter(Boolean);
  if (parcelIds.length === 0) return;
  await Parcel.updateMany(
    { _id: { $in: parcelIds } },
    { $addToSet: { billedBillIds: billId } }
  );
}

// GET /api/bills — flat list, most recent first
router.get("/", async (req, res) => {
  const bills = await Bill.find().sort({ dateOfIssue: -1, createdAt: -1 });
  res.json(bills);
});

// GET /api/bills/grouped — bills bucketed by month (e.g. "January 2026"),
// most recent month first, bills within a month most recent first.
router.get("/grouped", async (req, res) => {
  const groups = await Bill.aggregate([
    { $sort: { dateOfIssue: -1, createdAt: -1 } },
    {
      $group: {
        _id: { monthKey: "$monthKey", monthLabel: "$monthLabel" },
        bills: { $push: "$$ROOT" },
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
        bills: 1,
        totalAmount: 1,
        count: 1,
      },
    },
  ]);
  res.json(groups);
});

// GET /api/bills/next-number?series=AZ — atomically allocates and returns
// the next bill number in that series, e.g. { billNo: "AZ:001" }.
router.get("/next-number", async (req, res) => {
  try {
    const { series } = req.query;
    if (!series || !series.trim()) {
      return res.status(400).json({ error: "Series is required." });
    }
    const billNo = await nextBillNumber(series);
    res.json({ billNo });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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