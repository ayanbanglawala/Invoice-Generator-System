import connectDb from "../_db.js";
import Customer from "../../server/models/Customer.js";

export default async function handler(req, res) {
  await connectDb();

  if (req.method === "GET") {
    const customers = await Customer.find().sort({ name: 1 });
    return res.status(200).json(customers);
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
