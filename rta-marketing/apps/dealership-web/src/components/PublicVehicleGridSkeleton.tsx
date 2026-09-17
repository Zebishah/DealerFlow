type PublicVehicleGridSkeletonProps = {
  count: number;
  variant: "featured" | "browse";
};

export function PublicVehicleGridSkeleton({ count, variant }: PublicVehicleGridSkeletonProps) {
  const gridClass = variant === "featured" ? "landing-vehicle-cards" : "public-inventory-grid";

  return <div className={`${gridClass} public-vehicle-skeleton-grid`} role="status" aria-label="Loading vehicle listings" aria-busy="true">
    {Array.from({ length: count }, (_, index) => <article className="public-vehicle-skeleton" aria-hidden="true" key={index}>
      <div className="public-vehicle-skeleton-image"><span /></div>
      <div className="public-vehicle-skeleton-copy">
        <span className="public-vehicle-skeleton-line public-vehicle-skeleton-line--source" />
        <span className="public-vehicle-skeleton-line public-vehicle-skeleton-line--title" />
        <span className="public-vehicle-skeleton-line public-vehicle-skeleton-line--title-short" />
        <div><span className="public-vehicle-skeleton-line public-vehicle-skeleton-line--price" /><span className="public-vehicle-skeleton-line public-vehicle-skeleton-line--meta" /></div>
        {variant === "browse" && <span className="public-vehicle-skeleton-line public-vehicle-skeleton-line--actions" />}
      </div>
    </article>)}
    <span className="visually-hidden">Loading vehicle listings</span>
  </div>;
}
