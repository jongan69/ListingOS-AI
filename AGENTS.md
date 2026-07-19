# Project Guidance

ListingOS is an Expo SDK 57 app with a Cloudflare Worker backend. Read the versioned Expo documentation at https://docs.expo.dev/versions/v57.0.0/ before changing framework behavior.

## Commit Rules

- Never mention Claude, Anthropic, or any AI assistant in commit messages, PR descriptions, or code comments.
- Never add `Co-Authored-By: Claude` or `🤖 Generated with Claude Code` trailers. Commits are authored by Jonathan Gan only.

## Required Practices

- Treat `src/shared/contracts.ts` as the mobile/Worker API contract source of truth.
- Run `npm run check` after code changes and `npm run export:android` after routing, dependency, or native-facing changes.
- Keep all secrets in `.dev.vars`, Wrangler secrets, or secure local environment files. Never use `EXPO_PUBLIC_*` for secrets.
- Do not add a backend URL field to the seller UI. Use `EXPO_PUBLIC_API_BASE_URL` only as a build-time development override.
- Do not use a production eBay publish as a routine UI test. Publishing is a live external mutation.
- Preserve the public Worker photo route. eBay must be able to fetch listing images without an app bearer token.
- Keep fixed-price Inventory API publishing as the default until an auction adapter is implemented and verified.
- Prefer one Metro server and direct native Android testing. For USB devices, verify `adb reverse tcp:8081 tcp:8081`.

## Architecture Boundaries

- `src/app`: routes only
- `src/screens`: screen orchestration and local UI state
- `src/components`: reusable presentation and shell behavior
- `src/lib`: API, query, persistence, and device utilities
- `src/config`: non-secret build configuration
- `src/shared`: cross-runtime Zod contracts
- `worker`: Cloudflare HTTP and Queue orchestration

See `README.md` and `docs/` before making architectural or operational changes.
