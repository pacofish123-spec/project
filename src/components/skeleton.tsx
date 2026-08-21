// Lightweight pulsing placeholders shown during a page's first fetch,
// so the UI reads as "loading" rather than flashing blank/plain text
// before the real cards, tiles, or table rows appear.

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="trip-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-card" key={index}>
          <div className="skeleton-line" style={{ width: "38%" }} />
          <div className="skeleton-line" style={{ width: "62%" }} />
          <div className="skeleton-line" style={{ width: "28%" }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTiles({ count = 4 }: { count?: number }) {
  return (
    <div className="dashboard-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-tile" key={index}>
          <div className="skeleton-line" />
          <div className="skeleton-line" style={{ width: "70%" }} />
          <div className="skeleton-line" style={{ width: "45%" }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonVehicleRows({ count = 3 }: { count?: number }) {
  return (
    <div className="host-vehicle-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <article className="host-vehicle-row" key={index}>
          <div className="host-vehicle-thumb skeleton-line" style={{ height: "100%" }} />
          <div className="host-vehicle-info">
            <div className="skeleton-line" style={{ width: "50%" }} />
            <p><span className="skeleton-line" style={{ width: "70%", display: "inline-block" }} /></p>
          </div>
          <div className="skeleton-line" style={{ width: 70, height: 30 }} />
        </article>
      ))}
    </div>
  );
}

export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className="skeleton-table" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => <div className="skeleton-row" key={index} />)}
    </div>
  );
}
