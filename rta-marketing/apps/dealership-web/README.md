# Dealer Flow Web

React/TypeScript dealership workspace and public vehicle inventory. Built with Vite, TanStack Query, React Router, Tailwind CSS, and Recharts. Includes leads, sales, analytics, team workflows, vehicle intelligence, and the read-only Dealer Flow assistant.

## Development

From `rta-marketing/`, install workspace dependencies with `npm ci`, copy `apps/dealership-web/.env.example` to `apps/dealership-web/.env`, and configure the local API URL. Run `npm run dev:dealership-web`; the API runs separately with `npm run dev:dealership-api`.

## Checks

From `rta-marketing/apps/dealership-web/`:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Browser smoke checks use `npm run test:e2e` with the documented API/test setup. See the [root project guide](../../../README.md), [workspace guide](../../README.md), and [environment contract](../../docs/deployment/environment.md). Workspace package identifiers retain their existing `@rta/*` names.
