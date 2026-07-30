const API_URL = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
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
