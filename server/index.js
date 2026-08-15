import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import customerRoutes from "./routes/customers.js";
import billRoutes from "./routes/bills.js";
import parcelRoutes from "./routes/parcels.js";
import dealerBillRoutes from "./routes/dealerBills.js";

dotenv.config();

const app = express();
app.use(cors());
// Parcel photos arrive as base64 JSON — the default 100kb express.json()
// limit is nowhere near enough for a compressed photo (~200-800kb typical).
app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, dbState: mongoose.connection.readyState });
});

app.use("/api/customers", customerRoutes);
app.use("/api/bills", billRoutes);
app.use("/api/parcels", parcelRoutes);
app.use("/api/dealer-bills", dealerBillRoutes);

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/invoice_manager";

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected:", MONGODB_URI);
    app.listen(PORT, () => console.log(`API server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
