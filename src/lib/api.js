const API_URL = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error(
      `Could not reach the API at ${API_URL}. Make sure the backend is running (or, on Vercel, that the deployment finished and MONGODB_URI is set).`
    );
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------- Customers ----------
export function getCustomers() {
  return request("/customers");
}

export function saveCustomer(customer) {
  return request("/customers", {
    method: "POST",
    body: JSON.stringify(customer),
  });
}

export function deleteCustomer(id) {
  return request(`/customers/${id}`, { method: "DELETE" });
}

// ---------- Bills ----------
export function getBills() {
  return request("/bills");
}

// Returns [{ monthKey, monthLabel, bills, totalAmount, count }, ...]
// most recent month first.
export function getBillsGrouped() {
  return request("/bills/grouped");
}

export function getBill(id) {
  return request(`/bills/${id}`);
}

export function createBill(bill) {
  return request("/bills", {
    method: "POST",
    body: JSON.stringify(bill),
  });
}

export function deleteBill(id) {
  return request(`/bills/${id}`, { method: "DELETE" });
}

export function computeTotals(items) {
  const totalQty = (items || []).reduce((s, i) => s + Number(i.qty || 0), 0);
  const totalAmount = (items || []).reduce(
    (s, i) => s + Number(i.qty || 0) * Number(i.price || 0),
    0
  );
  return { totalQty, totalAmount };
}

// ---------- Parcels (photo staging, pre-invoice) ----------
export function getParcels() {
  return request("/parcels");
}

export function createParcel(payload) {
  return request("/parcels", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteParcel(id) {
  return request(`/parcels/${id}`, { method: "DELETE" });
}

// ---------- Dealer Bills (parcel bundles sent to the dealer) ----------
export function getDealerBills() {
  return request("/dealer-bills");
}

export function getDealerBill(id) {
  return request(`/dealer-bills/${id}`);
}

export function createDealerBill(payload) {
  return request("/dealer-bills", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function priceDealerBill(id, payload) {
  return request(`/dealer-bills/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function updateDealerBillItems(id, payload) {
  return request(`/dealer-bills/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteDealerBill(id) {
  return request(`/dealer-bills/${id}`, { method: "DELETE" });
}

// ---------- Reports (date-range export) ----------
export function getReport({ from, to } = {}) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return request(`/reports${qs ? `?${qs}` : ""}`);
}
