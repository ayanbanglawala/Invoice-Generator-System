import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import Parcel from "../../server/models/Parcel.js";
import Bill from "../../server/models/Bill.js";
import DealerBill from "../../server/models/DealerBill.js";

function buildDateFilter(from, to) {
  if (!from && !to) return null;
  const filter = {};
  if (from) filter.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) filter.$lte = new Date(`${to}T23:59:59.999Z`);
  return filter;
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { from, to } = req.query;
  const dateFilter = buildDateFilter(from, to);

  const parcelQuery = dateFilter ? { createdAt: dateFilter } : {};
  const billQuery = dateFilter ? { dateOfIssue: dateFilter } : {};
  const dealerBillQuery = dateFilter ? { createdAt: dateFilter } : {};

  const [parcels, bills, dealerBills] = await Promise.all([
    Parcel.find(parcelQuery)
      .sort({ createdAt: 1 })
      .populate("billedBillIds", "billNo")
      .populate("dealerBillId", "billNo status"),
    Bill.find(billQuery).sort({ dateOfIssue: 1 }),
    DealerBill.find(dealerBillQuery).sort({ createdAt: 1 }),
  ]);

  return res.status(200).json({ parcels, bills, dealerBills });
}
