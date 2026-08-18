import Parcel from "../models/Parcel.js";

/**
 * Applies an update to a DealerBill document in place (does not save it —
 * caller is responsible for bill.save()). Handles three independent things,
 * any combination of which may be present in `payload`:
 *
 *  - `parcelIds`: the full desired set of parcels for this bundle. Parcels
 *    newly added get linked (dealerBillId = this bill) and appended as new
 *    items (price 0, qty 1). Parcels removed get unlinked (dealerBillId =
 *    null) and dropped from items. Existing items for parcels that remain
 *    keep whatever price/qty they already had.
 *  - `items`: price/qty overrides keyed by parcelId, for the existing
 *    pricing-entry flow.
 *  - `note` / `billNo`: simple field updates.
 *
 * Throws a plain Error with a user-facing message on validation failure.
 */
export async function applyDealerBillUpdate(bill, payload) {
  const { parcelIds, items, note, billNo } = payload || {};

  if (Array.isArray(parcelIds)) {
    const desired = new Set(parcelIds.map(String));
    const current = new Set(bill.items.map((it) => String(it.parcelId)));

    const toAdd = [...desired].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !desired.has(id));

    if (toAdd.length > 0) {
      const newParcels = await Parcel.find({ _id: { $in: toAdd } });
      if (newParcels.length !== toAdd.length) {
        throw new Error("One or more selected parcels no longer exist.");
      }
      const takenElsewhere = newParcels.filter(
        (p) => p.dealerBillId && String(p.dealerBillId) !== String(bill._id)
      );
      if (takenElsewhere.length > 0) {
        throw new Error(
          `${takenElsewhere.map((p) => p.dNumber).join(", ")} already belong to another dealer bundle.`
        );
      }

      const newItems = newParcels.map((p) => ({
        parcelId: p._id,
        dNumber: p.dNumber,
        name: p.note,
        qty: 1,
        price: 0,
      }));
      bill.items = [...bill.items.filter((it) => desired.has(String(it.parcelId))), ...newItems];

      await Parcel.updateMany(
        { _id: { $in: toAdd } },
        { $set: { dealerBillId: bill._id } }
      );
    } else {
      bill.items = bill.items.filter((it) => desired.has(String(it.parcelId)));
    }

    if (toRemove.length > 0) {
      await Parcel.updateMany(
        { _id: { $in: toRemove } },
        { $set: { dealerBillId: null, dealerPrice: null } }
      );
    }
  }

  if (Array.isArray(items)) {
    const overrideById = new Map(items.map((it) => [String(it.parcelId), it]));
    bill.items = bill.items.map((existing) => {
      const incoming = overrideById.get(String(existing.parcelId));
      if (!incoming) return existing;
      const base = typeof existing.toObject === "function" ? existing.toObject() : existing;
      return {
        ...base,
        price: Number(incoming.price) || 0,
        qty: Number(incoming.qty) > 0 ? Number(incoming.qty) : 1,
      };
    });
  }

  if (bill.items.length === 0) {
    throw new Error("A dealer bill needs at least one piece — add one before saving, or delete the bill instead.");
  }

  // Keep each parcel's denormalized dealerPrice in sync with this bill's
  // current item prices (covers both the `items` price-edit path and the
  // `parcelIds` composition-edit path, since either can change what a
  // parcel's price should read).
  const pricedUpdates = bill.items
    .filter((it) => Number(it.price) > 0)
    .map((it) => ({
      updateOne: {
        filter: { _id: it.parcelId },
        update: { $set: { dealerPrice: Number(it.price) } },
      },
    }));
  if (pricedUpdates.length > 0) {
    await Parcel.bulkWrite(pricedUpdates);
  }

  if (typeof note === "string") bill.note = note.trim();
  if (typeof billNo === "string" && billNo.trim()) bill.billNo = billNo.trim();

  // Any item still at price 0 means it hasn't been priced yet — keep/return
  // the bundle to "packed" so the price-entry screen picks it back up.
  // If every item is priced AND this update actually went through the
  // pricing flow (an `items` payload), promote to "priced". A composition
  // -only edit (`parcelIds` with no `items`) never auto-jumps the status on
  // its own — it just preserves whatever status the bundle already had.
  const hasUnpriced = bill.items.some((it) => Number(it.price) === 0);
  if (hasUnpriced) {
    bill.status = "packed";
  } else if (Array.isArray(items)) {
    bill.status = "priced";
  }
}