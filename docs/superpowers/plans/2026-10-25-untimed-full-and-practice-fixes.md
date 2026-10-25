# Mock and Practice corrections

The user specified the desired behavior directly. Work in the existing checkout; preserve existing edits, imported content and publication history. No new deployment or merge.

- [x] Reproduce untimed single-use playback and sibling locking in server tests; reproduce lost queued assembly recovery; retain timed security tests with explicit timed fixtures.
- [x] Separate timed restrictions from untimed playback in existing services/views and player. Add pause, replay, seek and speed controls for untimed attempts; retain answer persistence and warn about irreversible playback loss only for timed attempts.
- [x] Permit an explicit retry of queued assembly, expose retry in the studio, and restore the outdated local worker registration before rebuilding the user's already-published four Parts.
- [x] Apply the user's screenshot correction: remove the Practice editor's bounded height/internal scrolling; allow the document to scroll while preserving exercise paging.
- [x] Apply the subsequent admin screenshot request: retain header/sidebar/content geometry and sibling navigation across book/volume/test/Part pages.
- [x] Run server/client suites and build, then browser regressions including exit/return, Full readiness, editor expansion and mobile overflow. Update task/status evidence and limitations.

Verification and environment limits are recorded in docs/STATUS.md. The user requested limiting further broad testing; final checks used the three relevant browser workflows, client suite/build and direct persisted Full readiness. No merge, deployment or push.
