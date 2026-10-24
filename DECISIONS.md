# Decisions
- 2026-10-24: Empty repository; implement listening first. Follow supplied screenshot palette/spacing and substitute PracticeIELTS branding. Do not seed copyrighted books or fictional progress.
- Production and Compose use PostgreSQL. Explicit DATABASE_URL absent means SQLite for portable development/tests; never imply this verifies PostgreSQL.
- JWT access token held in memory, rotating refresh token in HttpOnly cookie; same-origin proxy and CSRF protection on cookie endpoints. Registration cannot assign elevated roles. No default credential.
- Manual transcript workflow is first supported workflow. Automatic AI/alignment is a future provider-dependent milestone, never simulated.
- Sessions pin immutable transcript versions. Historical scores remain valid after revisions.
- User authorizes direct main pushes; no force pushes, no deployment implied.
