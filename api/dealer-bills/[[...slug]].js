import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import DealerBill from "../../server/models/DealerBill.js";
import Parcel from "../../server/models/Parcel.js";
import { nextBillNumber } from "../../server/lib/billCounter.js";
import { applyDealerBillUpdate } from "../../server/lib/dealerBillUpdate.js";

// This single file handles every /api/dealer-bills/* route:
//   GET/POST /api/dealer-bills
//   GET/PUT/DELETE /api/dealer-bills/:id
// (See api/bills/[[...slug]].js for why this is one catch-all file instead
// of several — Vercel's Hobby plan caps a deployment at 12 functions total.)

const DEALER_BILL_SERIES_OPTIONS = ["AZ", "G"];
const DEFAULT_DEALER_BILL_SERIES = "AZ";

async function handleList(req, res) {
  const bills = await DealerBill.find().sort({ createdAt: -1 });
  return res.status(200).json(bills);
}

async function handleCreate(req, res) {
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

async function handleGetOne(req, res, id) {
  const bill = await DealerBill.findById(id);
  if (!bill) return res.status(404).json({ error: "Dealer bill not found." });
  return res.status(200).json(bill);
}

// Handles three things independently (see applyDealerBillUpdate): adding
// /removing parcels (`parcelIds`), editing price/qty per item (`items`),
// and editing `note`/`billNo`.
async function handleUpdateOne(req, res, id) {
  try {
    const bill = await DealerBill.findById(id);
    if (!bill) return res.status(404).json({ error: "Dealer bill not found." });

    await applyDealerBillUpdate(bill, req.body || {});
    await bill.save();

    return res.status(200).json(bill);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
}

async function handleDeleteOne(req, res, id) {
  await Parcel.updateMany({ dealerBillId: id }, { $set: { dealerBillId: null, dealerPrice: null } });
  await DealerBill.findByIdAndDelete(id);
  return res.status(204).end();
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  const slug = Array.isArray(req.query.slug) ? req.query.slug : [];

  // /api/dealer-bills/:id
  if (slug.length === 1) {
    const id = slug[0];
    if (req.method === "GET") return handleGetOne(req, res, id);
    if (req.method === "PUT") return handleUpdateOne(req, res, id);
    if (req.method === "DELETE") return handleDeleteOne(req, res, id);
    res.setHeader("Allow", "GET, PUT, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // /api/dealer-bills
  if (slug.length === 0) {
    if (req.method === "GET") return handleList(req, res);
    if (req.method === "POST") return handleCreate(req, res);
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(404).json({ error: "Not found." });
}
