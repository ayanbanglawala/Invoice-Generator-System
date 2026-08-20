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

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://ayanchhipa2278:ayan8722@ayandb.9poow.mongodb.net/invoice-generator-db";

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected:", MONGODB_URI);

  const bills = await DealerBill.find();
  console.log(`Checking ${bills.length} dealer bundle(s).`);

  let updatedBills = 0;
  let updatedItems = 0;
  let missingParcel = 0;

  for (const bill of bills) {
    const parcelIds = bill.items.map((it) => it.parcelId).filter(Boolean);
    const parcels = await Parcel.find({ _id: { $in: parcelIds } });
    const nameByParcelId = new Map(parcels.map((p) => [String(p._id), p.customerName]));

    let changed = false;
    // Rebuild the whole items array (rather than mutating individual
    // subdocuments in place) and reassign it — with `{ _id: false }`
    // subdocuments, in-place field mutation doesn't always get picked up
    // by Mongoose's change tracking, so reassigning + markModified is the
    // reliable way to make sure it actually persists on save().
    const newItems = bill.items.map((it) => {
      const obj = typeof it.toObject === "function" ? it.toObject() : { ...it };
      if (!obj.ownerName) {
        const owner = nameByParcelId.get(String(obj.parcelId));
        if (owner) {
          obj.ownerName = owner;
          changed = true;
          updatedItems += 1;
        } else {
          missingParcel += 1;
          console.warn(
            `  no matching parcel for ${obj.dNumber} in ${bill.billNo} (parcelId ${obj.parcelId}) — leaving as Unknown`
          );
        }
      }
      return obj;
    });

    if (changed) {
      bill.items = newItems;
      bill.markModified("items");
      await bill.save();
      updatedBills += 1;
      console.log(`Updated ${bill.billNo} (${bill._id})`);
    }
  }

  console.log(
    `Done. Updated ${updatedItems} item(s) across ${updatedBills} bundle(s). ${missingParcel} item(s) had no matching parcel and stayed Unknown.`
  );
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});