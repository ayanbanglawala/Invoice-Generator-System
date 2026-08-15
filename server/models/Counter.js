import mongoose from "mongoose";

// A tiny generic counter collection. Using $inc with upsert is atomic in
// MongoDB, so this is safe even with concurrent requests — unlike deriving
// "next number" from the max value currently in the Parcel collection,
// which resets to 0 the moment everything is deleted (exactly the bug we're
// fixing: D-numbers must never be reused, ever, regardless of deletions).
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

export async function nextSequence(key) {
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return counter.seq;
}

export default Counter;
