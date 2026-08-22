import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import Customer from "../../server/models/Customer.js";
import { parsePagination, pageResult, escapeRegex } from "../../server/lib/pagination.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  if (req.method === "GET") {
    const { q, page } = req.query || {};
    const usePagination = Boolean(q || page);

    if (!usePagination) {
      const customers = await Customer.find().sort({ name: 1 });
      return res.status(200).json(customers);
    }

    const match = {};
    if (q && q.trim()) {
      const re = new RegExp(escapeRegex(q.trim()), "i");
      match.$or = [{ name: re }, { phone: re }];
    }

    const { page: p, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 30 });
    const [items, total] = await Promise.all([
      Customer.find(match).sort({ name: 1 }).skip(skip).limit(limit),
      Customer.countDocuments(match),
    ]);

    return res.status(200).json(pageResult({ items, page: p, limit, total }));
  }

  if (req.method === "POST") {
    try {
      const { id, name, phone, address } = req.body || {};
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required." });
      }
      let customer;
      if (id) {
        customer = await Customer.findByIdAndUpdate(
          id,
          { name: name.trim(), phone: (phone || "").trim(), address: (address || "").trim() },
          { new: true, runValidators: true }
        );
        if (!customer) return res.status(404).json({ error: "Customer not found." });
      } else {
        customer = await Customer.create({
          name: name.trim(),
          phone: (phone || "").trim(),
          address: (address || "").trim(),
        });
      }
      return res.status(201).json(customer);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
