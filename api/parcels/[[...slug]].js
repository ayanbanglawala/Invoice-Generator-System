import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import Parcel from "../../server/models/Parcel.js";
// Populate below needs "Bill" and "DealerBill" registered with Mongoose —
// importing them (even though unused directly here) makes that happen.
// eslint-disable-next-line no-unused-vars
import Bill from "../../server/models/Bill.js";
// eslint-disable-next-line no-unused-vars
import DealerBill from "../../server/models/DealerBill.js";
import { uploadParcelImage } from "../../server/lib/blob.js";
import { nextDNumber } from "../../server/lib/parcelCounter.js";

// This single file handles every /api/parcels/* route:
//   GET/POST /api/parcels
//   DELETE /api/parcels/:id
//   GET /api/parcels/pending
//   GET /api/parcels/stats
// (See api/bills/[[...slug]].js for why this is one catch-all file instead
// of several — Vercel's Hobby plan caps a deployment at 12 functions total.)

async function handleStats(req, res) {
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
  return res.status(200).json({ total, pending, billed: total - pending });
}

async function handlePending(req, res) {
  const parcels = await Parcel.find({
    dealerPrice: { $ne: null },
    $or: [{ billedBillIds: { $exists: false } }, { billedBillIds: { $size: 0 } }],
  })
    .sort({ createdAt: -1 })
    .populate("dealerBillId", "billNo status");
  return res.status(200).json(parcels);
}

async function handleList(req, res) {
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
    return res.status(200).json({ parcels: parcels.slice(0, limitNum), page: pageNum, hasMore });
  }

  const parcels = await Parcel.find(filter)
    .sort({ createdAt: -1 })
    .populate("billedBillIds", "billNo")
    .populate("dealerBillId", "billNo status");
  return res.status(200).json(parcels);
}

async function handleCreate(req, res) {
  try {
    const { customerId, customerName, customerPhone, note, image } = req.body || {};

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

    return res.status(201).json(parcel);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
}

async function handleDeleteOne(req, res, id) {
  await Parcel.findByIdAndDelete(id);
  return res.status(204).end();
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  const slug = Array.isArray(req.query.slug) ? req.query.slug : [];

  // /api/parcels/stats
  if (slug.length === 1 && slug[0] === "stats") {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }
    return handleStats(req, res);
  }

  // /api/parcels/pending
  if (slug.length === 1 && slug[0] === "pending") {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }
    return handlePending(req, res);
  }

  // /api/parcels/:id
  if (slug.length === 1) {
    const id = slug[0];
    if (req.method === "DELETE") return handleDeleteOne(req, res, id);
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // /api/parcels
  if (slug.length === 0) {
    if (req.method === "GET") return handleList(req, res);
    if (req.method === "POST") return handleCreate(req, res);
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(404).json({ error: "Not found." });
}
