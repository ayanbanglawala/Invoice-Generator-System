import { Router } from "express";
import Customer from "../models/Customer.js";
import { parsePagination, pageResult, escapeRegex } from "../lib/pagination.js";

const router = Router();

// GET /api/customers?q=&page=&limit=
// Backward-compatible default (no query params): full unfiltered list,
// used by dropdown pickers elsewhere in the app (parcel capture, bill
// creation, etc.) which need every customer available at once. Once q/
// page is present: paginated + searched, used by the Customers tab list.
router.get("/", async (req, res) => {
  const { q, page } = req.query;
  const usePagination = Boolean(q || page);

  if (!usePagination) {
    const customers = await Customer.find().sort({ name: 1 });
    return res.json(customers);
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

  res.json(pageResult({ items, page: p, limit, total }));
});

// POST /api/customers  (create or update — send _id to update)
router.post("/", async (req, res) => {
  try {
    const { id, name, phone, address } = req.body;
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
    res.status(201).json(customer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/customers/:id
router.delete("/:id", async (req, res) => {
  await Customer.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

export default router;
