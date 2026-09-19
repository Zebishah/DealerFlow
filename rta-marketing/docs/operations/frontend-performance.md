# Frontend performance audit

The existing frontend already uses route-level lazy loading and Vite chunking.
No production browser trace or external service was used during this change,
so this document records findings that are verifiable from the repository and
does not invent Core Web Vitals or before/after measurements.

## Current findings

- Dealership routes are lazy-loaded in `src/app/routes.ts`.
- Inventory and dashboard data use TanStack Query rather than manual fetch
  loops.
- Public vehicle cards use dedicated responsive image components and an API
  image proxy for approved source hosts.
- `public/rta-hero-vehicle.png` remains the source asset. It was not converted
  blindly because visual comparison and a production image trace were not
  available in this audit.

## Measurement procedure

Run `npm run build --workspace=@rta/dealership-web`, record Vite's emitted
chunk sizes, and compare a Lighthouse/DevTools trace for the landing page and
authenticated inventory page. Review image transfer size, LCP, polling while
the tab is hidden, and query cache hit behavior before making a targeted asset
or polling change.
