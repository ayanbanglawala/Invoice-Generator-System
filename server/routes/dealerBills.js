import { Router } from "express";
import DealerBill from "../models/DealerBill.js";
import Parcel from "../models/Parcel.js";
import { applyDealerBillUpdate } from "../lib/dealerBillUpdate.js";

const router = Router();

// GET /api/dealer-bills
router.get("/", async (req, res) => {
  const bills = await DealerBill.find().sort({ createdAt: -1 });
  res.json(bills);
});

// POST /api/dealer-bills — bundle selected parcels under a new A-number
router.post("/", async (req, res) => {
  try {
    const { billNo, note, parcelIds } = req.body;

    if (!billNo || !billNo.trim()) {
      return res.status(400).json({ error: "Bill number is required." });
    }
    if (!Array.isArray(parcelIds) || parcelIds.length === 0) {
      return res.status(400).json({ error: "Select at least one parcel photo." });
    }

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
      qty: 1,
      price: 0,
    }));

    const dealerBill = await DealerBill.create({
      billNo: billNo.trim(),
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
