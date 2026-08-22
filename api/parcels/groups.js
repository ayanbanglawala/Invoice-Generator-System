import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import Parcel from "../../server/models/Parcel.js";
import { parsePagination, pageResult } from "../../server/lib/pagination.js";
import { buildParcelStatusMatch } from "../../server/lib/parcelFilters.js";

// GET /api/parcels/groups?status=&page=&limit=
// See server/routes/parcels.js for the matching Express route — same
// aggregation, kept identical on purpose.
export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 30 });
  const statusMatch = buildParcelStatusMatch(req.query?.status);

  const pipeline = [
    ...(statusMatch ? [{ $match: statusMatch }] : []),
    {
      $group: {
        _id: { $ifNull: ["$customerId", "$customerName"] },
        customerId: { $first: "$customerId" },
        customerName: { $first: "$customerName" },
        totalCount: { $sum: 1 },
        pendingCount: {
          $sum: {
            $cond: [{ $eq: [{ $size: { $ifNull: ["$billedBillIds", []] } }, 0] }, 1, 0],
          },
        },
        latestCreatedAt: { $max: "$createdAt" },
      },
    },
    { $sort: { latestCreatedAt: -1 } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: "count" }],
      },
    },
  ];

  const [result] = await Parcel.aggregate(pipeline);
  const items = (result?.items || []).map((g) => ({
    key: String(g.customerId || g.customerName),
    customerId: g.customerId || null,
    customerName: g.customerName,
    totalCount: g.totalCount,
    pendingCount: g.pendingCount,
    latestCreatedAt: g.latestCreatedAt,
  }));
  const total = result?.totalCount?.[0]?.count || 0;

  return res.status(200).json(pageResult({ items, page, limit, total }));
}
