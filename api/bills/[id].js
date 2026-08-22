import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import Bill from "../../server/models/Bill.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();
  const { id } = req.query;

  if (req.method === "GET") {
    const bill = await Bill.findById(id);
    if (!bill) return res.status(404).json({ error: "Bill not found." });
    return res.status(200).json(bill);
  }

  if (req.method === "DELETE") {
    await Bill.findByIdAndDelete(id);
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
