# Deployment verification — 22 October 2026

Verified the backend in Python 3.12 Docker images with a separate PostgreSQL 17 `blog_test` database and disposable credentials. Development and production databases were not used for these tests.

| Check                                                                 | Result                                                                                                                                        |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend pytest suite, including database and HTML sanitization tests  | 109 passed, no skips                                                                                                                          |
| Backend Ruff lint and formatting                                      | Passed; 64 files formatted correctly                                                                                                          |
| Backend mypy                                                          | Passed; 46 source files                                                                                                                       |
| Production Docker image build                                         | Passed                                                                                                                                        |
| Production image startup and database readiness                       | Healthy; runtime used restricted `blog_api` database role                                                                                     |
| Disposable database migration downgrade, upgrade, metadata comparison | Passed, no schema drift                                                                                                                       |
| Production-mode authentication over an HTTPS ASGI test origin         | Secure/HttpOnly cookie, credentialed CORS, CSRF rejection, rotation, immediate access-token revocation on logout, and disabled Swagger passed |
| Chrome against the containerized API                                  | Login passed; dashboard and `/articles` stayed authenticated after reload; logout stayed effective after reload                               |
| Dashboard `npm run check`                                             | Passed, including 43 tests and production build                                                                                               |
| Production Compose refresh-session environment forwarding             | Custom lifetime and SameSite settings passed through to API and migration services                                                            |

Added `REFRESH_SESSION_DAYS` and `REFRESH_COOKIE_SAMESITE` forwarding to the backend's production Compose file. Added a dashboard regression test for successful automatic access-token renewal.

## Deployment boundary

The tested code is ready for deployment. The HTTP browser test used local loopback URLs; the production-mode HTTPS test used an in-process ASGI transport. Public HTTPS termination, production secrets, deployed CORS origins, and browser cookie behavior on the actual public domains still require a deployment smoke check. For cross-site API/dashboard hosting, configure `REFRESH_COOKIE_SAMESITE=none` with HTTPS, or use same-site custom domains; third-party cookie restrictions can affect cross-site hosting.

Apply migration `0002_refresh_sessions` to the production database before starting the updated API, and deploy the matching dashboard. The migration was applied previously to the configured development database, not production. Existing users must sign in once to obtain a refresh cookie.

Evidence: [authenticated article page after refresh](session-refresh.png), [login page after logout and refresh](session-logout.png).
