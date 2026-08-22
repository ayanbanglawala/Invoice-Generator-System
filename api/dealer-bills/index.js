import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import DealerBill from "../../server/models/DealerBill.js";
import Parcel from "../../server/models/Parcel.js";
import { nextBillNumber } from "../../server/lib/billCounter.js";

const DEALER_BILL_SERIES_OPTIONS = ["AZ", "G"];
const DEFAULT_DEALER_BILL_SERIES = "AZ";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  if (req.method === "GET") {
    const bills = await DealerBill.find().sort({ createdAt: -1 });
    return res.status(200).json(bills);
  }

  if (req.method === "POST") {
    try {
      const { note, parcelIds, series } = req.body || {};

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

      return res.status(201).json(dealerBill);
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}