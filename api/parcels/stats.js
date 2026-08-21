import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import Parcel from "../../server/models/Parcel.js";

// GET /api/parcels/stats — total, pending, and billed counts via a single
// index-backed aggregate, instead of downloading every parcel to count them.
export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const [result] = await Parcel.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: {
          $sum: {
            $cond: [{ $eq: [{ $size: { $ifNull: ["$billedBillIds", []] } }, 0] }, 1, 0],
          },
        },
      },
    },
  ]);
  const total = result?.total || 0;
  const pending = result?.pending || 0;
  return res.status(200).json({ total, pending, billed: total - pending });
}
