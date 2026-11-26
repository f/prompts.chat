# Deploying to Spacefast

[Spacefast](https://spacefast.com) runs Next.js apps as an OpenNext worker: a
V8 isolate with Node.js compatibility, no filesystem and no outbound TCP.
`sf publish` builds the app locally with the Spacefast Next adapter, packages it
with OpenNext and uploads the result to your Space (`<slug>.space.fast`).

Vercel and Docker/Node deployments are unaffected by anything in this guide.

> **Status: blocked on bundle size.** prompts.chat's server bundle is about
> 54.5 MiB, and Spacefast's limit is 8 MiB. `sf publish` builds successfully and
> then stops at its size check. See [Bundle size](#bundle-size) below. The rest
> of this guide is what a deployment needs once that limit is met, and it
> applies as-is to smaller forks.

## Requirements

- **Next.js 16.2 or 16.3.** The Spacefast adapter supports `>=16.2 <16.4` (or
  15.5.24+). This repository pins `next ~16.3.8`.
- **The `sf` CLI**, signed in: see the [CLI guide](https://spacefast.com/docs/cli).
  Run `sf whoami` to check.
- **A Postgres database reachable over HTTPS/WebSockets.** Workers cannot open
  TCP connections, so the app uses Neon's serverless driver there
  (`@prisma/adapter-neon`). Neon works directly. Another Postgres needs a Neon
  compatible HTTP/WebSocket proxy in front of it.

## Build and publish

From the repository root:

```bash
# Build-time settings (see "Environment variables") must be in this shell
export NEXT_PUBLIC_APP_URL="https://prompts.space.fast"

sf publish --dry-run --json   # shows the plan: Next.js detected, npm ci, npm run build
sf publish
```

There is no build command in `sf.jsonc` on purpose. With none set, `sf publish`
detects Next.js and runs its pipeline:

1. `npm ci`, then `npm run build` with `NEXT_ADAPTER_PATH` set. `prebuild`
   generates the Prisma client and `src/lib/bundled-files.generated.ts`.
2. `opennextjs-cloudflare build`, using an `open-next.config.ts` the CLI writes
   for the build and removes afterwards.
3. An esbuild pass that bundles the worker and checks it against the size limit.

Setting `build.command` in `sf.jsonc` turns that pipeline off.

The build detects Spacefast from `NEXT_ADAPTER_PATH`. To force a target, set
`PCHAT_DEPLOY_TARGET=spacefast`, `vercel` or `node`. On Spacefast the build:

- uses the Neon driver;
- serves images unoptimized;
- reports Sentry errors from the browser only (the server SDK needs Node);
- traces the ESM build of `@opentelemetry/api` that OpenNext bundles into the
  proxy.

## Database migrations

`sf publish` never touches the database. Run migrations yourself, from a machine
that can reach the database over TCP, before publishing code that needs them:

```bash
DATABASE_URL="postgresql://…" DIRECT_URL="postgresql://…" npm run db:deploy   # prisma migrate deploy
```

If the Space shares a database with another deployment (prompts.space.fast
shares prompts.chat's), run migrations from one pipeline only, and deploy the
schema before either app depends on it.

## Environment variables

Set runtime variables with `sf env set`. Variables are secret by default. Keys
in a local `.env.server` are also synced as secrets on `sf publish`. Spacefast
withholds `DATABASE_URL`, `POSTGRES_URL` and similar names from workers, so the
app reads `PCHAT_DATABASE_URL` first.

### Runtime secrets

| Variable | Notes |
| --- | --- |
| `PCHAT_DATABASE_URL` | **Required.** Neon connection string (pooled host is fine). |
| `AUTH_SECRET` | **Required.** Or `NEXTAUTH_SECRET`. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | If `github` is in `auth.providers`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | If `google` is enabled. |
| `AUTH_APPLE_ID`, `AUTH_APPLE_SECRET` | If `apple` is enabled. |
| `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` | If `azure` is enabled. |
| `AUTH_OIDC_*`, `AUTH_OAUTH_*` | Generic SSO; see `.env.example`. |
| `CRON_SECRET` | For external schedulers that send `Authorization: Bearer`. |
| `S3_*` or `DO_SPACES_*` | If media storage is enabled. Uploads use signed `fetch` requests on workers. |
| `OPENAI_API_KEY` | Optional AI search and generation. Also `OPENAI_BASE_URL`, `OPENAI_*_MODEL`. |
| `WIRO_API_KEY`, `FAL_API_KEY` | Optional media generation. |

### Runtime plain variables

Set these with `--no-secret`. Cron path templates can read only plain
variables.

| Variable | Notes |
| --- | --- |
| `AUTH_URL` | `https://prompts.space.fast`. Or `NEXTAUTH_URL`. |
| `AUTH_TRUST_HOST` | `true`. Auth.js sets this itself only on Vercel. |
| `CRON_PATH_TOKEN` | Random string. Enables `/api/cron/reset-credits/<token>`; see [Crons](#crons). |
| `PCHAT_PROMPTS_CSV_URL` | Optional. The admin CSV import fetches `prompts.csv` from this URL, since workers have no project filesystem. Defaults to the GitHub raw file. |
| `PCHAT_DB_DRIVER` | Optional. `neon` (default on Spacefast) or `prisma`. |

```bash
sf env set PCHAT_DATABASE_URL          # prompts for the value, stored as a secret
sf env set AUTH_SECRET
sf env set AUTH_URL --no-secret
sf env set AUTH_TRUST_HOST --no-secret
sf env set CRON_PATH_TOKEN --no-secret
```

### Build time

Next.js inlines these when `npm run build` runs, so they must be in the shell
(or `.env.production.local`) where you run `sf publish`. Setting them with
`sf env set` has no effect on the build.

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Public origin, used in webhooks and as a URL fallback. |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser error reporting. Off on Spacefast unless set. |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Optional source map upload. |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | Upload limit in MB (default 4). |
| `PCHAT_IMAGE_OPTIMIZATION` | `off` by default on Spacefast; workers have no image optimizer. |
| `PCHAT_IMAGE_REMOTE_HOSTS` | Remote image hosts, comma-separated (default any). |
| `NEXT_PUBLIC_HOSTING_BADGE` | `vercel` or `none` (default `none` off Vercel). |
| `PCHAT_DEPLOY_TARGET` | Overrides detection. |
| `GOOGLE_ANALYTICS_ID`, `GOOGLE_ADSENSE_ACCOUNT` | Optional. |

## Crons

`sf.jsonc` declares the daily credit reset:

```jsonc
{ "path": "/api/cron/reset-credits/{{vars.CRON_PATH_TOKEN}}", "schedule": "daily" }
```

Spacefast crons are plain `GET` requests with no custom headers. The route
therefore authorizes the token in the path, compared in constant time. It
returns 404 when `CRON_PATH_TOKEN` is unset. The original
`/api/cron/reset-credits` route keeps its `Authorization: Bearer <CRON_SECRET>`
check for Vercel Cron, GitHub Actions (`.github/workflows/reset-credits.yml`) or
system cron.

After publishing, check that the template was expanded and run it once:

```bash
sf crons ls
sf crons run <cron-id>
```

Spacefast doesn't retry, and treats any response of 400 or above as a failure.

The template is written `{{vars.NAME}}`, without spaces. The CLI's local path
check rejects the documented `{{ vars.NAME }}` form. If `sf crons ls` shows the
template unexpanded, remove the cron from `sf.jsonc`. Then point an external
scheduler at `/api/cron/reset-credits` with the Bearer header instead.

## OAuth callback URLs

Register each enabled provider's callback with the provider:

```
https://prompts.space.fast/api/auth/callback/github
https://prompts.space.fast/api/auth/callback/google
https://prompts.space.fast/api/auth/callback/apple
```

For a custom domain, register that origin too and set `AUTH_URL` and
`NEXT_PUBLIC_APP_URL` to it.

## Limits

| Limit | Value | Effect on prompts.chat |
| --- | --- | --- |
| Worker bundle | 8 MiB, raw (not gzip) | **Exceeded**; see below. |
| Routes | 256 | Within. |
| Cache seed | 2 MiB per entry, 8 MiB total | Larger prerendered entries are skipped and rendered on demand. |
| Runtime variables | 64 keys, 16 KiB per value, 64 KiB total | Within. |
| Crons | 8 per Space; 3 on the Personal plan | 1 used. |
| Request body | Keep `NEXT_PUBLIC_MAX_UPLOAD_MB` at or below the host limit. | Default 4 MB. |
| Egress IPs | Not fixed | A database IP allowlist can't be used. |

`sharp` isn't available on workers. Uploaded images are stored as uploaded
instead of being converted to JPEG.

## Bundle size

Measured with the CLI's own bundler (`sf` 0.8.0, OpenNext 1.20.6, Next 16.3.8):
the worker is **54.5 MiB raw, 12.3 MiB gzip**. The limit is 8 MiB raw. It is a
constant in the CLI and is also enforced by the server's manifest schema, so
neither a plan nor a flag raises it.

| Part | Size |
| --- | --- |
| Server handler (all routes) | 47.0 MiB |
| Proxy (middleware) | 1.3 MiB |
| resvg WASM (OG images) | 1.75 MiB |
| Yoga WASM and other assets | 0.25 MiB |
| OpenNext runtime and Next server internals | about 4.2 MiB |

Inside the server handler, by webpack module source size (49.4 MiB in total):

| Source | Size | Share |
| --- | --- | --- |
| Book chapters, compiled MDX, 17 locales | 24.4 MiB | 49% |
| App source (`src/`, compiled for both RSC and SSR) | 7.8 MiB | 16% |
| npm packages (zod 1.0, next-auth 0.5, react-markdown 0.5, openai 0.3, …) | 5.6 MiB | 11% |
| Kids levels, compiled MDX | 3.4 MiB | 7% |
| `next` | 3.2 MiB | 6% |
| Webpack runtime and generated modules | 2.2 MiB | 4% |
| Translation messages, 17 locales | 1.9 MiB | 4% |
| Metadata image routes | 1.0 MiB | 2% |

The book and kids pages choose their locale per request, so every locale's
chapters are compiled into the worker. Removing the book, kids levels and
messages entirely would still leave about 20 MiB. Getting under 8 MiB needs one
of the following:

- Spacefast supports larger bundles, or splits one Next app across several
  workers (OpenNext supports split functions).
- The book and kids content moves out of the server bundle, for example as
  static pages per locale or content loaded at runtime. App code and
  dependencies would then also need to shrink by more than half.

Smaller forks without the book may fit today. Run `sf publish --dry-run`, then
`sf publish`, and read the size reported by the final step.

## Other things to verify on first deploy

- **Interactive transactions** use a Neon WebSocket client per transaction.
  Plain queries use HTTP. Check that WebSocket egress to Neon works.
- **`x-spacefast-cron`** header: not trusted for authorization, since its
  guarantees are undocumented.
- **Password hashing** uses `bcryptjs` (pure JS). Check sign-in latency against
  the worker's CPU limit.
- **Proxy (middleware)** runs through OpenNext's Node middleware support, which
  is experimental.
