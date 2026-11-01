# Listening and Reading navigation cleanup

User direction: remove unnecessary/confusing UI and make the application coherent after Reading was added. The user delegated layout decisions after the proposed broad cleanup.

Keep the existing React app, private APIs, Library naming, navy/teal palette and all saved attempts. Library remains the shared content entry. Desktop navigation groups learning and review; mobile keeps five useful destinations. Remove future-module advertisements, decorative slogans and duplicate dashboard collections. Retain existing deep links and access to dictation, mocks, transcripts, mistakes, results and profile.

Dashboard prioritizes real resume/progress, then three clear choices: Listening practice, Listening mocks and Reading. Reading uses collection/book → test → passage rather than a flat list with redundant filters. Source review stays in the administrator workspace. Existing saved-answer behavior and publication boundaries are unchanged.

Approaches: isolated cosmetic changes would leave the conflicting flows; a new application would risk existing persisted behavior. Chosen implementation is an incremental cleanup of the existing shell, dashboard and Reading library with shared card styling.

Verification: component navigation and Reading hierarchy tests, full frontend tests/build, Django check, desktop/phone browser checks where available. No deployment or merge.

User clarification: administrator adding must follow the previous Listening hierarchy too. Reading administrator navigation is collection → volume → test → passages. Upload and authoring carry book/test context. Saved unpublished identities stay in the hierarchy; adding reserves occupied passage numbers. Import approval rejects existing identities; explicit existing-paper revision stays separate.
