import { Router } from "express";
import Parcel from "../models/Parcel.js";
// eslint-disable-next-line no-unused-vars
import Bill from "../models/Bill.js";
// eslint-disable-next-line no-unused-vars
import DealerBill from "../models/DealerBill.js";
import { uploadParcelImage } from "../lib/blob.js";
import { nextDNumber } from "../lib/parcelCounter.js";
import { parsePagination, pageResult } from "../lib/pagination.js";
import { buildParcelStatusMatch } from "../lib/parcelFilters.js";

const router = Router();

// GET /api/parcels/groups?status=&page=&limit=
// Powers the Parcels tab's accordion list: one row per customer, with
// counts only — no parcel documents (and therefore no photos) are loaded
// until that customer's group is actually opened. This is what makes the
// initial page load of Parcels cheap even with hundreds of photos.
router.get("/groups", async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 30 });
  const statusMatch = buildParcelStatusMatch(req.query.status);

  const pipeline = [
    ...(statusMatch ? [{ $match: statusMatch }] : []),
    {
      $group: {
        _id: { $ifNull: ["$customerId", "$customerName"] },
        customerId: { $first: "$customerId" },
        customerName: { $first: "$customerName" },
        totalCount: { $sum: 1 },
        pendingCount: {
          $sum: {
            $cond: [{ $eq: [{ $size: { $ifNull: ["$billedBillIds", []] } }, 0] }, 1, 0],
          },
        },
        latestCreatedAt: { $max: "$createdAt" },
      },
    },
    { $sort: { latestCreatedAt: -1 } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: "count" }],
      },
    },
  ];

  const [result] = await Parcel.aggregate(pipeline);
  const items = (result?.items || []).map((g) => ({
    key: String(g.customerId || g.customerName),
    customerId: g.customerId || null,
    customerName: g.customerName,
    totalCount: g.totalCount,
    pendingCount: g.pendingCount,
    latestCreatedAt: g.latestCreatedAt,
  }));
  const total = result?.totalCount?.[0]?.count || 0;

  res.json(pageResult({ items, page, limit, total }));
});

// GET /api/parcels
// Two modes, chosen so every *existing* caller keeps working unchanged:
//  - No `page` and no `customerId`/`status` in the query: behaves exactly
//    as before — the full, unfiltered list (used by screens that need to
//    pick from every parcel at once, e.g. "Add from Parcels" on a bill).
//  - `page` and/or `customerId`/`status` present: paginated + filtered,
//    used by the Parcels tab to lazy-load one customer group's photos
//    10 at a time.
router.get("/", async (req, res) => {
  const { customerId, status, page } = req.query;
  const usePagination = Boolean(page || customerId || (status && status !== "all"));

  if (!usePagination) {
    const parcels = await Parcel.find()
      .sort({ createdAt: -1 })
      .populate("billedBillIds", "billNo")
      .populate("dealerBillId", "billNo status");
    return res.json(parcels);
  }

  const { page: p, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 30 });
  const match = buildParcelStatusMatch(status) || {};
  if (customerId) match.customerId = customerId;

  const [items, total] = await Promise.all([
    Parcel.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("billedBillIds", "billNo")
      .populate("dealerBillId", "billNo status"),
    Parcel.countDocuments(match),
  ]);

  res.json(pageResult({ items, page: p, limit, total }));
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
