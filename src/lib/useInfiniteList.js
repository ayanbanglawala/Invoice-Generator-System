import { useCallback, useEffect, useRef, useState } from "react";

// A small, reusable "load 10, then load 10 more when you hit the bottom"
// hook, backed by an IntersectionObserver watching a sentinel <div> at the
// end of the list — the same pattern most native apps and feeds use, so
// scrolling never needs a manual "Load More" tap.
//
//   fetchPage(page) -> Promise<{ items, hasMore }>
//   deps            -> whenever these change (filters, search, etc.) the
//                       list resets and refetches from page 1.
//
// Returns { items, loading, loadingMore, error, hasMore, sentinelRef, reload }.
export function useInfiniteList(fetchPage, deps = []) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const sentinelRef = useRef(null);
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const loadingRef = useRef(false);

  // Reset + load page 1 whenever the filter/search deps change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setItems([]);
    setPage(1);
    setHasMore(true);
    loadingRef.current = true;

    fetchPageRef
      .current(1)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items || []);
        setHasMore(!!res.hasMore);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        loadingRef.current = false;
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    fetchPageRef
      .current(nextPage)
      .then((res) => {
        setItems((prev) => [...prev, ...(res.items || [])]);
        setHasMore(!!res.hasMore);
        setPage(nextPage);
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setLoadingMore(false);
        loadingRef.current = false;
      });
  }, [page, hasMore]);

  // Observe the sentinel div — once it scrolls into view, load the next
  // page. This fires again automatically after each append, since the
  // sentinel simply moves further down instead of disappearing.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  const reload = useCallback(() => {
    setPage(1);
    setHasMore(true);
    setLoading(true);
    setError("");
    fetchPageRef
      .current(1)
      .then((res) => {
        setItems(res.items || []);
        setHasMore(!!res.hasMore);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { items, setItems, loading, loadingMore, error, hasMore, sentinelRef, reload };
}
