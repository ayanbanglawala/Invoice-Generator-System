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
import { parsePagination, pageResult } from "../../server/lib/pagination.js";
import { buildParcelStatusMatch } from "../../server/lib/parcelFilters.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  if (req.method === "GET") {
    const { customerId, status, page } = req.query || {};
    const usePagination = Boolean(page || customerId || (status && status !== "all"));

    if (!usePagination) {
      const parcels = await Parcel.find()
        .sort({ createdAt: -1 })
        .populate("billedBillIds", "billNo")
        .populate("dealerBillId", "billNo status");
      return res.status(200).json(parcels);
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

    return res.status(200).json(pageResult({ items, page: p, limit, total }));
  }

  if (req.method === "POST") {
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

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
