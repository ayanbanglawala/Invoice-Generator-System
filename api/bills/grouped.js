import connectDb from "../_db.js";
import Bill from "../../server/models/Bill.js";

export default async function handler(req, res) {
  await connectDb();

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

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
