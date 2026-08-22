// Small, dependency-free pagination helpers shared by both the Express
// routes (server/routes/*.js, local dev) and the Vercel serverless
// functions (api/*.js, production) — both import from here so the paging
// contract (page/limit/skip in, {items,page,limit,total,hasMore} out) can
// never drift between the two backends.

export const DEFAULT_PAGE_LIMIT = 10;

// Reads `page`/`limit` off a query object (works for both Express's
// req.query and Vercel's req.query — both are plain string-valued objects).
export function parsePagination(query = {}, { defaultLimit = DEFAULT_PAGE_LIMIT, maxLimit = 50 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// Wraps a page of items with the metadata the frontend's infinite-scroll
// hook needs to know whether to keep requesting more pages.
export function pageResult({ items, page, limit, total }) {
  return {
    items,
    page,
    limit,
    total,
    hasMore: page * limit < total,
  };
}

// Escapes user-typed search text before it's dropped into a MongoDB
// regex filter, so characters like `.` `(` `+` don't get interpreted as
// regex syntax (or, worse, throw on invalid patterns).
export function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
