import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import Bill from "../../server/models/Bill.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  if (req.method === "GET") {
    const bills = await Bill.find().sort({ dateOfIssue: -1, createdAt: -1 });
    return res.status(200).json(bills);
  }

  if (req.method === "POST") {
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

      return res.status(201).json(bill);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
