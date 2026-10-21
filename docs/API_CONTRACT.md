# FastAPI integration map

Source inspected: `/Users/macbookm1pro/Personal Projects/Blogs_Backend`, Blog API 1.0.0. `openapi.json` is an export from `create_app().openapi()` using isolated test settings, without backend startup or database access. Backend service code was also inspected because OpenAPI does not describe every permission or transition invariant.

Every path below is relative to `VITE_API_BASE_URL`, which includes `/api/v1`.

| UI                                 | Existing API                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| Login and identity                 | `POST /auth/login`, `GET /auth/me`                                                   |
| Administrative article list/detail | `GET /admin/articles`, `GET /admin/articles/{id}`                                    |
| Draft creation/edit/delete         | `POST /articles`, `PATCH /articles/{id}`, `DELETE /articles/{id}`                    |
| Publication controls               | `POST /articles/{id}/publish`, `POST /articles/{id}/unpublish`                       |
| Archive and restore                | `PATCH /articles/{id}` with `status=archived` or `status=draft`                      |
| Classifications                    | `GET/POST /categories`, `/tags`, `/article-types`; `PATCH/DELETE /{collection}/{id}` |
| Request review                     | `GET /admin/article-requests`, `GET/PATCH/DELETE /admin/article-requests/{id}`       |
| Staff management                   | `GET/POST /users`, `GET/PATCH/DELETE /users/{id}`; DELETE deactivates                |
| Audit logs                         | `GET /admin-logs`, `GET /admin-logs/{id}`                                            |
| Profile updates for admins         | `PATCH /users/{current_user_id}`                                                     |
| Dashboard                          | Metadata and records from existing article/request administrative lists              |
| Preferences                        | Browser-local, no API                                                                |

## Query contracts

All list endpoints accept `page`, `page_size` (maximum 100), `sort`, and an optional `search` parameter. Search is functional only where a title/name/topic column exists. Audit logs do **not** support search despite sharing the base query schema. User search matches names, not emails; no unsupported role/active user filters are sent.

- Articles: title search; category/tag/type **slugs**; featured boolean; administrative status; timezone-aware publication bounds. Sorts: `title`, `created_at`, `updated_at`, `published_at`, `view_count` with optional `-` prefix.
- Classifications: name search; `include_inactive=true` only for admins. Sorts: `name`, `slug`, `created_at`, `updated_at`. Category trees and parent selections collect all pages before use.
- Requests: topic search; status; sorts `topic`, `status`, `created_at`, `updated_at`.
- Users: name search; sorts `name`, `email`, `role`, `created_at`, `updated_at`.
- Logs: `user_id`, `entity_type`, `entity_id`; sorts `created_at`, `action`, `entity_type`. No action filter or date filter exists.

## Writes and validation

Article payloads use `featured_image`, `featured_image_alt`, `article_type_id`, `category_ids`, `tag_ids`, `content_html`, and `schema` exactly as defined by FastAPI. They never include author IDs, views, or timestamps. Categories/tags replace sets when supplied. Unchanged fields are omitted on PATCH; nullable text and schema fields can be cleared with explicit `null`.

Drafts require title, nonempty serialized HTML, and an article type. Publication additionally validates active author/classifications and content on the backend. Admins/editors can publish archived records through the dedicated endpoint or restore them to draft first. Publishing and published-to-draft transitions never use a generic form PATCH.

Frontend validation covers field lengths, ASCII slug format, safe URLs, JSON validity, Schema.org context/types, bounded JSON-LD, and plain-text notes. It is a usability layer; FastAPI also performs HTML sanitization, encoded-markup validation, reference validation, and permission checks. Server validation errors are shown with safe field location information and request IDs, without echoing inputs.

## Capability boundaries

- There are no refresh tokens, cookies, server logout, or bearer-token revocation. Tokens remain in memory. Reload requires login.
- Only admins can update user records, including their own name/email. Editors/authors have read-only profiles.
- Reviewer and audit actor fields are UUIDs. Admins can resolve them through authorized `/users` reads. Editors see the reviewer ID or their own known name.
- No image upload, statistics, backend settings, persistent drafts, revision history, automatic request-to-article generation, or scheduling API exists.
- Public article detail increments views. Dashboard preview never calls it.
- No ETag/version/precondition contract exists. The UI cannot promise conflict detection for concurrent editors.
- Backend errors are authoritative for last-admin protection, category cycles, inactive references, and conflicting slugs.
- Live backend smoke checks require a running API, approved CORS origin, and provisioned staff accounts. No backend or database files were modified.
