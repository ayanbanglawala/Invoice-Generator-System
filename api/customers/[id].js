import connectDb from "../_db.js";
import Customer from "../../server/models/Customer.js";

export default async function handler(req, res) {
  await connectDb();
  const { id } = req.query;

  if (req.method === "DELETE") {
    await Customer.findByIdAndDelete(id);
    return res.status(204).end();
  }

  res.setHeader("Allow", "DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
