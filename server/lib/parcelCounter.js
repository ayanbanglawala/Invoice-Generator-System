import Counter, { nextSequence } from "../models/Counter.js";
import Parcel from "../models/Parcel.js";

const COUNTER_KEY = "parcelDNumber";

export async function nextDNumber() {
  // One-time bootstrap: if this counter has never been used before (e.g.
  // right after this feature was added, with existing parcels already in
  // the database), seed it from the highest D-number that currently exists
  // so numbering continues forward instead of colliding with D1, D2, etc.
  const exists = await Counter.exists({ key: COUNTER_KEY });
  if (!exists) {
    const all = await Parcel.find({}, { dNumber: 1 }).lean();
    const max = all.reduce((m, p) => {
      const n = parseInt(String(p.dNumber || "").replace(/\D/g, ""), 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    try {
      await Counter.create({ key: COUNTER_KEY, seq: max });
    } catch {
      // Another concurrent request bootstrapped it first — that's fine,
      // nextSequence below will just increment from whatever it set.
    }
  }

  const seq = await nextSequence(COUNTER_KEY);
  return `D${seq}`;
}
