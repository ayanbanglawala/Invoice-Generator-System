import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import Bill from "../../server/models/Bill.js";

// GET /api/bills/stats — total invoice count + total billed amount, via an
// index-backed aggregate so the Home screen header doesn't need to
// download every bill document just to show two numbers.
export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const [result] = await Bill.aggregate([
    { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" } } },
  ]);
  return res.status(200).json({ count: result?.count || 0, totalAmount: result?.totalAmount || 0 });
}
