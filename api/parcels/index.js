import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import Parcel from "../../server/models/Parcel.js";
import { uploadParcelImage } from "../../server/lib/blob.js";

async function nextDNumber() {
  const all = await Parcel.find({}, { dNumber: 1 }).lean();
  const max = all.reduce((m, p) => {
    const n = parseInt(String(p.dNumber || "").replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `D${max + 1}`;
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  if (req.method === "GET") {
    const parcels = await Parcel.find().sort({ createdAt: -1 });
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
