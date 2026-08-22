const API_URL = import.meta.env.VITE_API_URL || "/api";

// A short-lived cache for GET requests only. This isn't meant to keep data
// fresh for a long time — it's just there to make quick tab-switching (Home
// -> Parcels -> Home) feel instant instead of re-fetching + re-rendering a
// loading spinner every single time, since most of these lists don't
// change second-to-second. Any create/update/delete call wipes the whole
// cache, so you're never more than one write away from fresh data.
const GET_CACHE_TTL_MS = 15000;
const getCache = new Map(); // path -> { data, expiresAt }

function cacheGet(path) {
  const entry = getCache.get(path);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    getCache.delete(path);
    return undefined;
  }
  return entry.data;
}

function cacheSet(path, data) {
  getCache.set(path, { data, expiresAt: Date.now() + GET_CACHE_TTL_MS });
}

export function clearApiCache() {
  getCache.clear();
}

async function request(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  if (method === "GET") {
    const cached = cacheGet(path);
    if (cached !== undefined) return cached;
  }

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

  if (method !== "GET") {
    // A write happened — anything we had cached could now be stale, so
    // rather than tracking which exact resources it touched, just clear
    // everything. Simple and always correct.
    clearApiCache();
  }

  if (res.status === 204) return null;
  const data = await res.json();
  if (method === "GET") cacheSet(path, data);
  return data;
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
export function getBills(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/bills${qs ? `?${qs}` : ""}`);
}

// Paginated bill fetch for infinite scroll: { bills, page, hasMore }.
export function getBillsPage(page, limit = 20) {
  return request(`/bills?page=${page}&limit=${limit}`);
}

// { count, totalAmount } — a fast aggregate for the Home screen header,
// instead of downloading every bill just to sum/count them.
export function getBillsStats() {
  return request("/bills/stats");
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
export function getParcels(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/parcels${qs ? `?${qs}` : ""}`);
}

// Paginated parcel fetch for infinite scroll: { parcels, page, hasMore }.
export function getParcelsPage(page, limit = 24) {
  return request(`/parcels?page=${page}&limit=${limit}`);
}

// Only dealer-priced, not-yet-billed parcels — what the Home screen's
// Pending Payments section actually needs, without pulling in the whole
// (ever-growing) parcel history.
export function getPendingParcels() {
  return request("/parcels/pending");
}

// { total, pending, billed } — a fast aggregate for header counts on the
// Parcels tab, instead of downloading every parcel just to count them.
export function getParcelsStats() {
  return request("/parcels/stats");
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