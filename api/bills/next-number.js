import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import { nextBillNumber } from "../../server/lib/billCounter.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { series } = req.query;
    if (!series || !String(series).trim()) {
      return res.status(400).json({ error: "Series is required." });
    }
    const billNo = await nextBillNumber(series);
    return res.status(200).json({ billNo });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}