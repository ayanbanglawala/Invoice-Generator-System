import connectDb from "../_db.js";
import { applyCors } from "../_cors.js";
import Customer from "../../server/models/Customer.js";

// This single file handles every /api/customers/* route:
//   GET/POST /api/customers
//   DELETE /api/customers/:id
// (See api/bills/[[...slug]].js for why this is one catch-all file instead
// of several — Vercel's Hobby plan caps a deployment at 12 functions total.)

async function handleList(req, res) {
  const customers = await Customer.find().sort({ name: 1 });
  return res.status(200).json(customers);
}

async function handleCreate(req, res) {
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

async function handleDeleteOne(req, res, id) {
  await Customer.findByIdAndDelete(id);
  return res.status(204).end();
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  await connectDb();

  const slug = Array.isArray(req.query.slug) ? req.query.slug : [];

  // /api/customers/:id
  if (slug.length === 1) {
    const id = slug[0];
    if (req.method === "DELETE") return handleDeleteOne(req, res, id);
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // /api/customers
  if (slug.length === 0) {
    if (req.method === "GET") return handleList(req, res);
    if (req.method === "POST") return handleCreate(req, res);
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(404).json({ error: "Not found." });
}
