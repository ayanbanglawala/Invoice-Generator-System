// Auth stays local (static admin/admin session) and business info stays a
// code-level config (src/config/business.js). Customers and bills now live
// in MongoDB via the Express API in src/lib/api.js — re-exported here so
// every screen keeps importing from this one file.
import business from "../config/business";
export * from "./api";

const KEYS = {
  AUTH: "inv_auth",
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
