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
// GET /api/parcels?page=1&limit=24        -> { parcels, page, hasMore }
// GET /api/parcels?customerId=<id>        -> all parcels for one customer
router.get("/", async (req, res) => {
  const { page, limit, customerId, customerName } = req.query;
  const filter = {};
  if (customerId && customerName) {
    filter.$or = [{ customerId }, { customerName }];
  } else if (customerId) {
    filter.customerId = customerId;
  }

  if (page || limit) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
    const parcels = await Parcel.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum + 1)
      .populate("billedBillIds", "billNo")
      .populate("dealerBillId", "billNo status");
    const hasMore = parcels.length > limitNum;
    return res.json({ parcels: parcels.slice(0, limitNum), page: pageNum, hasMore });
  }

  const parcels = await Parcel.find(filter)
    .sort({ createdAt: -1 })
    .populate("billedBillIds", "billNo")
    .populate("dealerBillId", "billNo status");
  res.json(parcels);
});

// GET /api/parcels/pending — only parcels that are dealer-priced but not
// yet billed to the customer. This is the exact subset the Home screen's
// "Pending Payments" section needs, so it no longer has to download every
// parcel ever created (which only grows over time) just to compute it.
router.get("/pending", async (req, res) => {
  const parcels = await Parcel.find({
    dealerPrice: { $ne: null },
    $or: [{ billedBillIds: { $exists: false } }, { billedBillIds: { $size: 0 } }],
  })
    .sort({ createdAt: -1 })
    .populate("dealerBillId", "billNo status");
  res.json(parcels);
});

// GET /api/parcels/stats — total, pending, and billed counts via a single
// index-backed aggregate, instead of downloading every parcel to count them.
router.get("/stats", async (req, res) => {
  const [result] = await Parcel.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: {
          $sum: {
            $cond: [{ $eq: [{ $size: { $ifNull: ["$billedBillIds", []] } }, 0] }, 1, 0],
          },
        },
      },
    },
  ]);
  const total = result?.total || 0;
  const pending = result?.pending || 0;
  res.json({ total, pending, billed: total - pending });
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
