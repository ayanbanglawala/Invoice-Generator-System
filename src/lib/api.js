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

// Turns a params object into a query string, skipping empty/undefined/
// "all" values so a call with no real filters produces a bare path —
// this is what keeps the "no params = old unfiltered behavior" contract
// on the backend working from the frontend side too.
function toQueryString(params = {}) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === "all") continue;
    usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
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
// Called with no args: full unfiltered list (dropdown pickers elsewhere).
// Called with { q, page, limit }: paginated + searched (Customers tab).
export function getCustomers(params) {
  return request(`/customers${toQueryString(params)}`);
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
// Called with no args: full unfiltered list (Customer Ledger, etc).
// Called with { monthKey, customerId, q, page, limit }: paginated/filtered
// (Dashboard's lazy per-month load and search).
export function getBills(params) {
  return request(`/bills${toQueryString(params)}`);
}

// Returns { items: [{ monthKey, monthLabel, totalAmount, count }, ...],
// page, limit, total, hasMore } — most recent month first. Bills for a
// given month are NOT included; fetch them lazily with getBills({ monthKey }).
export function getBillsGrouped(params) {
  return request(`/bills/grouped${toQueryString(params)}`);
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
// Called with no args: full unfiltered list (Add-from-Parcels dropdown,
// Pending Payments calc, Customer Ledger, dealer-bundle item picker).
// Called with { customerId, status, page, limit }: paginated + filtered
// (the Parcels tab's per-customer lazy-loaded grid).
export function getParcels(params) {
  return request(`/parcels${toQueryString(params)}`);
}

// Returns { items: [{ key, customerId, customerName, totalCount,
// pendingCount, latestCreatedAt }], page, limit, total, hasMore } — one
// row per customer, most recently active first. No parcel photos/documents
// are fetched here; call getParcels({ customerId, status }) once a group
// is opened.
export function getParcelGroups(params) {
  return request(`/parcels/groups${toQueryString(params)}`);
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
// Called with no args: full unfiltered list.
// Called with { status, q, page, limit }: paginated + filtered (Dealer
// Bills tab: All / Awaiting Price / Priced, plus search).
export function getDealerBills(params) {
  return request(`/dealer-bills${toQueryString(params)}`);
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