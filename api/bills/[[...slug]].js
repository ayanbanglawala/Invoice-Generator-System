import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import Bill from "../../server/models/Bill.js";
import Parcel from "../../server/models/Parcel.js";

// This single file handles every /api/bills/* route:
//   GET/POST /api/bills
//   GET/DELETE /api/bills/:id
//   GET /api/bills/stats
//   GET /api/bills/grouped
// Vercel's Hobby plan caps a deployment at 12 serverless functions total,
// and this app has several route groups (bills, parcels, dealer-bills,
// customers) each with a handful of endpoints — five separate files just
// for bills alone was more than the app could afford. Using an optional
// catch-all file ([[...slug]].js) means the whole group is ONE function,
// with the routing done here instead of by the filesystem.
async function linkParcelsToBill(items, billId) {
  const parcelIds = items.map((it) => it.parcelId).filter(Boolean);
  if (parcelIds.length === 0) return;
  await Parcel.updateMany(
    { _id: { $in: parcelIds } },
    { $addToSet: { billedBillIds: billId } }
  );
}

async function handleStats(req, res) {
  const [result] = await Bill.aggregate([
    { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" } } },
  ]);
  return res.status(200).json({ count: result?.count || 0, totalAmount: result?.totalAmount || 0 });
}

async function handleGrouped(req, res) {
  const groups = await Bill.aggregate([
    { $sort: { dateOfIssue: -1, createdAt: -1 } },
    {
      $group: {
        _id: { monthKey: "$monthKey", monthLabel: "$monthLabel" },
        bills: { $push: "$$ROOT" },
        totalAmount: { $sum: "$totalAmount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.monthKey": -1 } },
    {
      $project: {
        _id: 0,
        monthKey: "$_id.monthKey",
        monthLabel: "$_id.monthLabel",
        bills: 1,
        totalAmount: 1,
        count: 1,
      },
    },
  ]);
  return res.status(200).json(groups);
}

async function handleList(req, res) {
  const { page, limit, customerId, customerName, q } = req.query;
  const filter = {};
  if (customerId && customerName) {
    filter.$or = [{ customerId }, { customerName }];
  } else if (customerId) {
    filter.customerId = customerId;
  }
  if (q && q.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ customerName: rx }, { billNo: rx }];
  }

  if (page || limit) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const bills = await Bill.find(filter)
      .sort({ dateOfIssue: -1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum + 1);
    const hasMore = bills.length > limitNum;
    return res.status(200).json({ bills: bills.slice(0, limitNum), page: pageNum, hasMore });
  }

  const bills = await Bill.find(filter).sort({ dateOfIssue: -1, createdAt: -1 });
  return res.status(200).json(bills);
}

async function handleCreate(req, res) {
  try {
    const { billNo, customerId, customerName, customerPhone, dateOfIssue, items, note } =
      req.body || {};

    if (!billNo || !billNo.trim()) {
      return res.status(400).json({ error: "Bill number is required." });
    }
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ error: "Customer is required." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one item is required." });
    }

    const bill = await Bill.create({
      billNo: billNo.trim(),
      customerId: customerId || null,
      customerName: customerName.trim(),
      customerPhone: (customerPhone || "").trim(),
      dateOfIssue: new Date(dateOfIssue),
      items,
      note: (note || "").trim(),
    });

    await linkParcelsToBill(items, bill._id);

    return res.status(201).json(bill);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

async function handleGetOne(req, res, id) {
  const bill = await Bill.findById(id);
  if (!bill) return res.status(404).json({ error: "Bill not found." });
  return res.status(200).json(bill);
}

async function handleDeleteOne(req, res, id) {
  await Bill.findByIdAndDelete(id);
  return res.status(204).end();
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  const slug = Array.isArray(req.query.slug) ? req.query.slug : [];

  // /api/bills/stats
  if (slug.length === 1 && slug[0] === "stats") {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }
    return handleStats(req, res);
  }

  // /api/bills/grouped
  if (slug.length === 1 && slug[0] === "grouped") {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }
    return handleGrouped(req, res);
  }

  // /api/bills/:id
  if (slug.length === 1) {
    const id = slug[0];
    if (req.method === "GET") return handleGetOne(req, res, id);
    if (req.method === "DELETE") return handleDeleteOne(req, res, id);
    res.setHeader("Allow", "GET, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // /api/bills
  if (slug.length === 0) {
    if (req.method === "GET") return handleList(req, res);
    if (req.method === "POST") return handleCreate(req, res);
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(404).json({ error: "Not found." });
}
