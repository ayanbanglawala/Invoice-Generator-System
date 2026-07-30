import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import customerRoutes from "./routes/customers.js";
import billRoutes from "./routes/bills.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, dbState: mongoose.connection.readyState });
});

app.use("/api/customers", customerRoutes);
app.use("/api/bills", billRoutes);

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
