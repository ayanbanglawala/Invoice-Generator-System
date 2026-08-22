import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import Bill from "../../server/models/Bill.js";
import { parsePagination, pageResult } from "../../server/lib/pagination.js";

// GET /api/bills/grouped?page=&limit=
// Month summaries only (no embedded bill documents) — see
// server/routes/bills.js for the matching Express route and the reasoning.
export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 60 });

  const all = await Bill.aggregate([
    {
      $group: {
        _id: { monthKey: "$monthKey", monthLabel: "$monthLabel" },
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
        totalAmount: 1,
        count: 1,
      },
    },
  ]);

  const total = all.length;
  const items = all.slice(skip, skip + limit);
  return res.status(200).json(pageResult({ items, page, limit, total }));
}
