# Security notes

This document records the security posture and dependency-audit result for the
portfolio freeze. It must be updated with the command output date when the
dependency lockfile changes.

## Runtime boundaries

- Secrets are server-only environment variables and are not included in Actor
  input or public frontend payloads.
- Apify input is strict and accepts only the approved site keys and bounded
  limits.
- Redis is used for API-side rate limits, AI quotas, and short-lived caches.
  Configured Redis failures fail closed for security-sensitive counters.
- Database and Apify operational endpoints require session/RBAC middleware.
- Image proxy host checks use exact approved hostnames and bounded redirects.
- Legacy worker writes require explicit safety gates and remain outside the
  active production Apify path.

## Dependency audit

Audited from `rta-marketing` on 2026-09-20:

```bash
npm audit --omit=dev
npm audit
```

Results were 14 production-tree advisories (13 moderate, 1 high), 33 total
including development tooling (1 low, 20 moderate, 12 high), and no critical
advisories. The production findings are primarily transitive Crawlee/Apify
families and `stream-json`; `apify` and `crawlee` are direct runtime
dependencies. `adm-zip` is transitive and high severity because of archive
extraction/DoS advisories. The available fixes either are unavailable or would
require a major/incompatible downgrade or a scraper-stack change, so no
dependency upgrade was applied in this pass.

The full-tree findings additionally include direct development dependencies
`@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, and `vitest`,
plus transitive ESLint/Vite/parser advisories. They are not shipped in the
Render runtime image. The project does not claim to be vulnerability-free;
follow-up should upgrade the Apify/Crawlee and dev-tool families in a tested,
separate compatibility change.

No `npm audit fix --force` was used as part of the portfolio freeze.
