import { useCallback, useRef } from "react";

// Attach the returned ref to a sentinel element at the bottom of a list.
// When it scrolls into view, onLoadMore() fires — guarded so it can't fire
// twice concurrently, and skipped entirely once hasMore is false.
//
// Usage:
//   const sentinelRef = useInfiniteScroll({ hasMore, loading, onLoadMore: loadNextPage });
//   ...
//   {hasMore && <div ref={sentinelRef} />}
export function useInfiniteScroll({ hasMore, loading, onLoadMore }) {
  const observerRef = useRef(null);

  const sentinelRef = useCallback(
    (node) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !hasMore || loading) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) onLoadMore();
        },
        { rootMargin: "200px" } // start loading a bit before it's actually visible
      );
      observerRef.current.observe(node);
    },
    [hasMore, loading, onLoadMore]
  );

  return sentinelRef;
}
