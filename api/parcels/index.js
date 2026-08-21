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

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  if (req.method === "GET") {
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
