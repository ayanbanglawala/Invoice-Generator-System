import { Router } from "express";
import Parcel from "../models/Parcel.js";
// eslint-disable-next-line no-unused-vars
import Bill from "../models/Bill.js";
// eslint-disable-next-line no-unused-vars
import DealerBill from "../models/DealerBill.js";
import { uploadParcelImage } from "../lib/blob.js";
import { nextDNumber } from "../lib/parcelCounter.js";

const router = Router();

// GET /api/parcels
router.get("/", async (req, res) => {
  const parcels = await Parcel.find()
    .sort({ createdAt: -1 })
    .populate("billedBillIds", "billNo")
    .populate("dealerBillId", "billNo status");
  res.json(parcels);
});

// POST /api/parcels
router.post("/", async (req, res) => {
  try {
    const { customerId, customerName, customerPhone, note, image } = req.body;

    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ error: "Customer is required." });
    }
    if (!note || !note.trim()) {
      return res.status(400).json({ error: "Note (phone / variant) is required." });
    }
    if (!image) {
      return res.status(400).json({ error: "Photo is required." });
    }

    const dNumber = await nextDNumber();
    const imageUrl = await uploadParcelImage(image, dNumber);

    const parcel = await Parcel.create({
      dNumber,
      customerId: customerId || null,
      customerName: customerName.trim(),
      customerPhone: (customerPhone || "").trim(),
      note: note.trim(),
      imageUrl,
    });

    res.status(201).json(parcel);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/parcels/:id
router.delete("/:id", async (req, res) => {
  await Parcel.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

export default router;
