# Decisions
- 2026-10-24: Empty repository; implement listening first. Follow supplied screenshot palette/spacing and substitute PracticeIELTS branding. Do not seed copyrighted books or fictional progress.
- Production and Compose use PostgreSQL. Explicit DATABASE_URL absent means SQLite for portable development/tests; never imply this verifies PostgreSQL.
- JWT access token held in memory, rotating refresh token in HttpOnly cookie; same-origin proxy and CSRF protection on cookie endpoints. Registration cannot assign elevated roles. No default credential.
- Manual transcript workflow is first supported workflow. Automatic AI/alignment is a future provider-dependent milestone, never simulated.
- Sessions pin immutable transcript versions. Historical scores remain valid after revisions.
- User authorizes direct main pushes; no force pushes, no deployment implied.

- Revised real workflow: local faster-whisper provider, asynchronous jobs with persistent states and retries; optional authoritative transcript matched to word anchors and uncertainty exposed. Word-timed chunks back easy dictation; medium becomes one sentence; hard 2–3 sentences. Existing manual versions remain backward compatible.
- Audio-only ingestion starts transcription automatically. Do not transcribe inside HTTP requests. Publication requires a successful, reviewed version and rights metadata.
- PDF input is privately retained and its selectable text extracted for teacher review; scans/uncertain parsing explicitly require authoring, not invented questions or answer keys. Both timed and untimed mocks use immutable published question/transcript snapshots.

- Preserve legacy practice grouping with grouping_version=0 when migrating old sessions. New sessions use grouping_version=1 (easy anchored chunks, medium one sentence, hard up to three). Include grouping version in session uniqueness so changed difficulty semantics never remap existing answers silently.

- Local speech verification succeeded with real original audio. Default model is pinned base.en (revision 3d3d5dee26484f91867d81cb899cfcf72b96be6c), with tiny.en available as a lighter alternative. Public model downloads need no HF token. Preserve TLS and validate LFS weight content hashes. Use the supported HTTPS download path behind the proxy.
- Pin PyAV 15.1.0: the unrestricted latest PyAV 19 removed metadata_errors used by faster-whisper 1.2.1; actual audio decoding exposed the incompatibility and the supported version restored it.
- Load root .env in Django settings without overriding runtime bindings. Plain manage.py and Celery commands now use the same configured database; the root run wrapper only supplies the working directory.
