import { Router } from "express";
import Parcel from "../models/Parcel.js";
import Bill from "../models/Bill.js";
import DealerBill from "../models/DealerBill.js";

const router = Router();

function buildDateFilter(from, to) {
  if (!from && !to) return null;
  const filter = {};
  if (from) filter.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) filter.$lte = new Date(`${to}T23:59:59.999Z`);
  return filter;
}

// GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", async (req, res) => {
  const { from, to } = req.query;
  const dateFilter = buildDateFilter(from, to);

  const parcelQuery = dateFilter ? { createdAt: dateFilter } : {};
  const billQuery = dateFilter ? { dateOfIssue: dateFilter } : {};
  const dealerBillQuery = dateFilter ? { createdAt: dateFilter } : {};

  const [parcels, bills, dealerBills] = await Promise.all([
    Parcel.find(parcelQuery)
      .sort({ createdAt: 1 })
      .populate("billedBillIds", "billNo")
      .populate("dealerBillId", "billNo status"),
    Bill.find(billQuery).sort({ dateOfIssue: 1 }),
    DealerBill.find(dealerBillQuery).sort({ createdAt: 1 }),
  ]);

  res.json({ parcels, bills, dealerBills });
});

export default router;
