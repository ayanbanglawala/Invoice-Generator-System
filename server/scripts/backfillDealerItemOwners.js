// One-time migration: fills in the new `ownerName` field on DealerBill
// items that were created before this field existed (looked up from each
// item's linked Parcel).
//
// Run locally with:
//   node server/scripts/backfillDealerItemOwners.js
//
// It reads MONGODB_URI the same way server/index.js does, so make sure your
// .env / environment has it set to the *same* database your app uses
// (local Mongo for local testing, or your Atlas URI to fix production data).

import mongoose from "mongoose";
import dotenv from "dotenv";
import DealerBill from "../models/DealerBill.js";
import Parcel from "../models/Parcel.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/invoice_manager";

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected:", MONGODB_URI);

  const bills = await DealerBill.find({ "items.ownerName": { $in: [null, ""] } });
  console.log(`Found ${bills.length} dealer bundle(s) with missing owner names.`);

  let updatedBills = 0;
  let updatedItems = 0;

  for (const bill of bills) {
    const parcelIds = bill.items.map((it) => it.parcelId).filter(Boolean);
    const parcels = await Parcel.find({ _id: { $in: parcelIds } });
    const nameByParcelId = new Map(parcels.map((p) => [String(p._id), p.customerName]));

    let changed = false;
    for (const item of bill.items) {
      if (!item.ownerName) {
        const owner = nameByParcelId.get(String(item.parcelId));
        if (owner) {
          item.ownerName = owner;
          changed = true;
          updatedItems += 1;
        }
      }
    }

    if (changed) {
      await bill.save();
      updatedBills += 1;
      console.log(`Updated ${bill.billNo} (${bill._id})`);
    }
  }

  console.log(`Done. Updated ${updatedItems} item(s) across ${updatedBills} bundle(s).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
