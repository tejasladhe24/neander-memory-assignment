# `@workspace/database`

Shared Drizzle schema/types package for the meeting domain.

## Includes

- Auth tables (`user`, `session`, `account`, `verification`, `jwks`)
- Schema + utility exports
- `getDb()` helper

## Important Files

- `src/schema.ts`
- `src/utils.ts`
- `drizzle.config.ts`
- `migrations/`

## Scripts

```bash
pnpm --filter @workspace/database build
pnpm --filter @workspace/database typecheck
```
