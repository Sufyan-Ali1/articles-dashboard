# Blog Admin

A responsive React + Vite + TypeScript editorial workspace for the existing Blog API. All production data comes from FastAPI. Test fixtures are confined to test files and are never imported by the application.

## Run locally

Requires Node.js 22.12 or newer (Node 22 LTS is recommended).

```sh
cp -n .env.example .env
npx --yes npm@11 ci
npm run dev
```

If npm 10 fails with `Cannot read properties of null (reading 'edgesOut')`, use a newer npm for this installation without replacing your global npm:

```sh
npx --yes npm@11 install --prefer-online --no-audit --no-fund
npm run dev
```

This is an npm Arborist peer-resolution crash. Vitest is pinned to `4.1.11` so its optional browser-adapter peers use a consistent patch version. Do not use `--force` or `--legacy-peer-deps` to hide dependency conflicts. `vite: command not found` means installation did not complete; Vite is a local development dependency and does not need a global installation.

Tiptap's core and optional menu extensions are pinned to `3.30.1`; Prettier is pinned to `3.9.8`. Use fresh registry metadata rather than `--prefer-offline` after an `ETARGET` failure. If an interrupted install leaves truncated native binaries, rebuild the generated `node_modules` directory. Keep the npm cache so valid downloads can be reused.

Open the Vite URL printed in the terminal. The API must be running separately. Set `VITE_API_BASE_URL` to its **full API prefix**, for example `http://localhost:8000/api/v1`. Restart Vite after changing environment variables. A missing or invalid value produces a configuration screen rather than fabricated data.

The initial administrator must already exist in the backend. Follow the backend's administrator bootstrap instructions; this dashboard does not register accounts or modify database configuration.

For local development, have the backend operator allowlist the exact Vite origin (normally `http://127.0.0.1:5173`). `localhost` and `127.0.0.1` are different origins. The dev server may choose a different port if 5173 is occupied; use the printed URL.

The dependency lockfile is now generated from a successful npm 11 installation. Typecheck, lint, formatting, all 40 tests, and the production build have passed. Use `npm ci` (or `npx --yes npm@11 ci` on machines affected by the npm 10 resolver issue) for reproducible reinstalls. Browser QA and authenticated live API verification are still outstanding; see [the implementation report](IMPLEMENTATION_REPORT.md).

## Commands

```sh
npm run dev           # development server
npm run typecheck     # strict TypeScript checks
npm run lint          # ESLint, no warnings allowed
npm run format:check  # Prettier verification
npm test              # Vitest + Testing Library + MSW
npm run build         # typecheck and production build
npm run preview       # serve the production output locally
npm run check         # all required checks
```

The tests run against intercepted API requests, not your development or production database. Live CRUD testing requires an explicitly disposable environment and accounts for all three roles.

## Architecture

- `src/app`: data router, protected layouts, lazy page boundaries.
- `src/components`: shared states, accessible dialogs, table controls, shadcn-style Radix primitives.
- `src/features`: auth, dashboard, articles/editor, classifications, requests, staff, logs, profile, preferences.
- `src/lib`: typed HTTP client, error normalization, permissions, query configuration, utilities.
- `src/hooks`: URL-based list state, identity scopes, and unsaved-change protection.
- `src/types`: backend-derived request and response models.
- `src/test`: fixtures, MSW handlers, and cross-feature workflow tests.
- `docs/openapi.json`: the inspected backend's generated contract, exported without starting services or accessing the database.

The API client accepts only explicit feature parameters. Lists use the backend's `data`/`meta` envelopes; single records use `data`; errors use the safe `error` envelope and correlation ID. Deletions handle empty 204 responses. Query requests are cancellable. Mutations do not automatically retry, including on timeouts where the server may already have committed.

## Authentication and permissions

Access tokens are held only in JavaScript memory. Refreshing, closing the page, logging out, or token expiry ends the session. The application warns one minute before expiry and clears private query caches on logout/expiry. Local logout does not revoke an issued JWT because the API has no revocation endpoint. Changing roles or deactivating an account remains enforced by the backend on every authenticated request.

| Workflow                                    | Admin                  | Editor        | Author        |
| ------------------------------------------- | ---------------------- | ------------- | ------------- |
| Create drafts                               | Yes                    | Yes           | Yes           |
| View articles                               | All                    | All           | Own           |
| Edit articles                               | All                    | All           | Own drafts    |
| Feature, publish/unpublish, archive/restore | Yes                    | Yes           | No            |
| Delete articles                             | Yes                    | No            | No            |
| Classifications                             | Manage active/inactive | Browse active | Browse active |
| Review requests                             | Yes                    | Yes           | No            |
| Delete requests                             | Yes                    | No            | No            |
| Staff and audit logs                        | Yes                    | No            | No            |
| Profile                                     | View/edit name/email   | View only     | View only     |

The interface hides unauthorized controls, but FastAPI is the security authority. A server-side 403 never triggers an unauthorized fallback request; 404 does not reveal whether a hidden record exists.

## Editorial behavior

- New articles are drafts. Creating a draft requires title, article type, and HTML content under the backend contract.
- Save and publish are separate requests. If publication fails after saving, the saved draft remains intact and the error is shown.
- Saving an already published article updates the live article immediately. Publication timestamps are server-owned.
- Optional empty fields become `null`; update payloads omit unchanged fields. Author ID, timestamps, status, and views are not editable through the article form. Dedicated controls handle allowed status transitions.
- Untouched backend HTML is preserved. Existing markup outside the visual editor's supported subset opens in source mode; leaving source mode is blocked until incompatible markup is removed. Preview sanitizes HTML, forbids executable embeds, and never increments public article views.
- Classification selections include previously linked inactive records. New inactive selections are blocked. Publication errors remain authoritative when references have changed.
- Slug collisions, referenced-classification deletion, category cycles, and last-admin conflicts are displayed without silently changing data.
- There is no autosave, upload, scheduling, revision history, or optimistic concurrency contract. Save explicitly. Concurrent edits use the backend's last-write behavior; a dirty form is not replaced by background data.

## Dashboard metrics

Counts use existing filtered administrative list metadata. Total views loads all article-summary pages in batches of 100, at most three concurrent page requests, and caches the completed sum for five minutes. Partial/inconsistent results are never presented as a complete total. These are nontransactional snapshots of raw API request counts, including bots—not unique visitors. Authors see only their own article metrics; request information is restricted to admins/editors.

## Cloudflare Pages

1. Install dependencies with network access, commit the generated lockfile, and pass `npm run check`.
2. Connect this repository to Cloudflare Pages, or upload a locally verified production build.
3. Set build command to `npm run build` and output directory to `dist`.
4. Set `NODE_VERSION=22` and `VITE_API_BASE_URL=https://your-api.example.com/api/v1` for each intended production/preview environment.
5. Have the backend operator allowlist the exact Pages/custom-domain origin in `CORS_ORIGINS`. No backend files are changed by this project. Wildcard origins are not supported by the backend's configuration.
6. Deploy, then test login and refresh `/articles`, `/articles/new`, and `/settings` directly.

Pages serves `index.html` for unknown navigation paths when there is no top-level `404.html`. This project intentionally omits that file and uses React Router for in-app not-found screens. See [Cloudflare's SPA documentation](https://developers.cloudflare.com/pages/configuration/serving-pages/). Existing static assets still resolve normally.

`public/_headers` supplies anti-framing, no-sniff, referrer, permission, and noindex policies. The UI self-hosts Inter from its font package. All `VITE_` values are public build-time configuration; never supply JWT, database, revalidation, or other backend secrets. This project does not create Cloudflare resources or publish automatically.

## Remaining backend capabilities

There are no refresh-session, server logout, non-admin self-profile update, upload, settings, analytics aggregate, reviewer-name lookup for editors, or conditional-update endpoints. Their absence is handled explicitly. See [API integration notes](docs/API_CONTRACT.md) and the [verification report](IMPLEMENTATION_REPORT.md).
