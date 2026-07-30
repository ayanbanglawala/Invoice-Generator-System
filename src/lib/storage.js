// Static/local data layer. Everything lives in localStorage — no backend (yet).
// Swap the functions below for real API calls later; every screen only talks
// to this file, so that's the one place you'll need to touch.
import business from "../config/business";

const KEYS = {
  AUTH: "inv_auth",
  CUSTOMERS: "inv_customers",
  BILLS: "inv_bills",
};

const STATIC_CREDENTIALS = { username: "admin", password: "admin" };

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------- Auth ----------
export function login(username, password) {
  if (
    username === STATIC_CREDENTIALS.username &&
    password === STATIC_CREDENTIALS.password
  ) {
    write(KEYS.AUTH, { loggedIn: true, username });
    return true;
  }
  return false;
}

export function logout() {
  localStorage.removeItem(KEYS.AUTH);
}

export function isLoggedIn() {
  const auth = read(KEYS.AUTH, null);
  return !!(auth && auth.loggedIn);
}

// ---------- Business (static letterhead info, edited in src/config/business.js) ----------
export function getBusiness() {
  return business;
}

// ---------- Customers ----------
export function getCustomers() {
  return read(KEYS.CUSTOMERS, []);
}

export function saveCustomer(customer) {
  const list = getCustomers();
  if (customer.id) {
    const idx = list.findIndex((c) => c.id === customer.id);
    if (idx >= 0) {
      list[idx] = customer;
      write(KEYS.CUSTOMERS, list);
      return customer;
    }
  }
  const newCustomer = { ...customer, id: crypto.randomUUID() };
  list.push(newCustomer);
  write(KEYS.CUSTOMERS, list);
  return newCustomer;
}

export function deleteCustomer(id) {
  const list = getCustomers().filter((c) => c.id !== id);
  write(KEYS.CUSTOMERS, list);
}

// ---------- Bills ----------
export function getBills() {
  return read(KEYS.BILLS, []).sort(
    (a, b) => new Date(b.dateOfIssue) - new Date(a.dateOfIssue)
  );
}

export function getBill(id) {
  return getBills().find((b) => b.id === id) || null;
}

export function createBill(bill) {
  const list = read(KEYS.BILLS, []);
  const newBill = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...bill,
  };
  list.push(newBill);
  write(KEYS.BILLS, list);
  return newBill;
}

export function deleteBill(id) {
  const list = read(KEYS.BILLS, []).filter((b) => b.id !== id);
  write(KEYS.BILLS, list);
}

export function computeTotals(items) {
  const totalQty = items.reduce((s, i) => s + Number(i.qty || 0), 0);
  const totalAmount = items.reduce(
    (s, i) => s + Number(i.qty || 0) * Number(i.price || 0),
    0
  );
  return { totalQty, totalAmount };
}
