import Counter, { nextSequence } from "../models/Counter.js";
import Bill from "../models/Bill.js";
import DealerBill from "../models/DealerBill.js";

// Series are 3-digit, zero-padded (AZ:001, AZ:002, ... AZ:999, then AZ:1000).
// Old manually-typed numbers like "A:214" are untouched — this only governs
// series generated through this helper.
const PAD_WIDTH = 3;

function counterKey(series) {
  return `billNo:${series}`;
}

function maxNumberInCollection(docs, prefix) {
  return docs.reduce((m, d) => {
    const n = parseInt(String(d.billNo || "").slice(prefix.length), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
}

// Allocates and RETURNS the next number for a series — this is not a
// preview. Same philosophy as D-numbers: once handed out, a number is
// never reused, even if the bill is never actually saved (e.g. the user
// picks a series, then cancels). That keeps numbering safe under
// concurrent requests without needing a reservation/rollback system.
export async function nextBillNumber(series) {
  const clean = String(series || "").trim().toUpperCase();
  if (!clean) throw new Error("Series is required.");

  const key = counterKey(clean);
  const exists = await Counter.exists({ key });
  if (!exists) {
    // Bootstrap from the highest existing number in this exact series so
    // numbering continues forward instead of colliding with bills already
    // created under this prefix. A given series can appear in either
    // collection — a dealer bundle's own number lives in DealerBill, and a
    // customer bill created from that bundle carries the same number into
    // Bill — so check both and take the overall highest.
    const prefix = `${clean}:`;
    const regex = { $regex: `^${prefix}\\d+$` };
    const [bills, dealerBills] = await Promise.all([
      Bill.find({ billNo: regex }, { billNo: 1 }).lean(),
      DealerBill.find({ billNo: regex }, { billNo: 1 }).lean(),
    ]);
    const max = Math.max(
      maxNumberInCollection(bills, prefix),
      maxNumberInCollection(dealerBills, prefix)
    );
    try {
      await Counter.create({ key, seq: max });
    } catch {
      // Lost the race to bootstrap it — fine, nextSequence below just
      // increments whatever another concurrent request already set.
    }
  }

  const seq = await nextSequence(key);
  return `${clean}:${String(seq).padStart(PAD_WIDTH, "0")}`;
}