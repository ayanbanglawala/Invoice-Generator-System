import { Router } from "express";
import Customer from "../models/Customer.js";

const router = Router();

// GET /api/customers
router.get("/", async (req, res) => {
  const customers = await Customer.find().sort({ name: 1 });
  res.json(customers);
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
