import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import Parcel from "../../server/models/Parcel.js";
import { uploadParcelImage } from "../../server/lib/blob.js";
import { nextDNumber } from "../../server/lib/parcelCounter.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  if (req.method === "GET") {
    const parcels = await Parcel.find()
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
