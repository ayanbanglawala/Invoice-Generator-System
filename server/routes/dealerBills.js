import { Router } from "express";
import DealerBill from "../models/DealerBill.js";
import Parcel from "../models/Parcel.js";
import { applyDealerBillUpdate } from "../lib/dealerBillUpdate.js";
import { nextBillNumber } from "../lib/billCounter.js";
import { parsePagination, pageResult, escapeRegex } from "../lib/pagination.js";

const DEALER_BILL_SERIES_OPTIONS = ["AZ", "G"];
const DEFAULT_DEALER_BILL_SERIES = "AZ";

const router = Router();

// GET /api/dealer-bills?status=&q=&page=&limit=
// Backward-compatible default (no query params): full unfiltered list.
// Once status/q/page is present: paginated + filtered, used by the
// Dealer Bills tab's status filter (All / Awaiting Price / Priced) and
// infinite-scroll list.
router.get("/", async (req, res) => {
  const { status, q, page } = req.query;
  const usePagination = Boolean((status && status !== "all") || q || page);

  if (!usePagination) {
    const bills = await DealerBill.find().sort({ createdAt: -1 });
    return res.json(bills);
  }

  const match = {};
  if (status === "packed" || status === "priced") match.status = status;
  if (q && q.trim()) {
    const re = new RegExp(escapeRegex(q.trim()), "i");
    match.$or = [
      { billNo: re },
      { "items.name": re },
      { "items.dNumber": re },
    ];
  }

  const { page: p, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 30 });
  const [items, total] = await Promise.all([
    DealerBill.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit),
    DealerBill.countDocuments(match),
  ]);

  res.json(pageResult({ items, page: p, limit, total }));
});

// POST /api/dealer-bills — bundle selected parcels under a new, auto
// -generated number in the chosen series (AZ or G). The bill number is
// never taken as free text from the client — it's allocated here,
// atomically, the moment parcels are sent to the dealer, so it can never
// collide or be skipped by mistake.
router.post("/", async (req, res) => {
  try {
    const { note, parcelIds, series } = req.body;

    if (!Array.isArray(parcelIds) || parcelIds.length === 0) {
      return res.status(400).json({ error: "Select at least one parcel photo." });
    }

    const cleanSeries = DEALER_BILL_SERIES_OPTIONS.includes(String(series || "").toUpperCase())
      ? String(series).toUpperCase()
      : DEFAULT_DEALER_BILL_SERIES;

    const parcels = await Parcel.find({ _id: { $in: parcelIds } });
    if (parcels.length !== parcelIds.length) {
      return res.status(400).json({ error: "One or more selected parcels no longer exist." });
    }
    const alreadyPacked = parcels.filter((p) => p.dealerBillId);
    if (alreadyPacked.length > 0) {
      return res.status(400).json({
        error: `${alreadyPacked
          .map((p) => p.dNumber)
          .join(", ")} already belong to another dealer bundle.`,
      });
    }

    const items = parcels.map((p) => ({
      parcelId: p._id,
      dNumber: p.dNumber,
      name: p.note,
      ownerName: p.customerName,
      qty: 1,
      price: 0,
    }));

    const billNo = await nextBillNumber(cleanSeries);

    const dealerBill = await DealerBill.create({
      billNo,
      note: (note || "").trim(),
      items,
    });

    await Parcel.updateMany(
      { _id: { $in: parcelIds } },
      { $set: { dealerBillId: dealerBill._id } }
    );

    res.status(201).json(dealerBill);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// GET /api/dealer-bills/:id
router.get("/:id", async (req, res) => {
  const bill = await DealerBill.findById(req.params.id);
  if (!bill) return res.status(404).json({ error: "Dealer bill not found." });
  res.json(bill);
});

// PUT /api/dealer-bills/:id — add/remove parcels (parcelIds) and/or edit
// price/qty per item (items) and/or note/billNo. See applyDealerBillUpdate.
router.put("/:id", async (req, res) => {
  try {
    const bill = await DealerBill.findById(req.params.id);
    if (!bill) return res.status(404).json({ error: "Dealer bill not found." });

    await applyDealerBillUpdate(bill, req.body || {});
    await bill.save();

    res.json(bill);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/dealer-bills/:id
router.delete("/:id", async (req, res) => {
  await Parcel.updateMany({ dealerBillId: req.params.id }, { $set: { dealerBillId: null, dealerPrice: null } });
  await DealerBill.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

export default router;