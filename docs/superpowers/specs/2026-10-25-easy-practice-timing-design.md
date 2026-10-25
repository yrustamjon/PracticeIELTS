# Easy Practice admin timing corrections

The administrator can open timing controls for the current Easy exercise, enter absolute audio start/end in seconds, preview the interval and save it. A successful save updates playback immediately and survives reload. Teachers and students cannot use the write API; Medium/Hard/Full do not expose it.

Corrections are stored as immutable `PracticeTimingRevision` snapshots attached to the published transcript and grouping version. A PracticeSession pins a revision; future Easy starts use the newest revision and the editing admin's active session advances to it with answers retained. Existing student sessions keep their old revision. Published transcript/word content and unpublished editor drafts are not changed.

Approaches considered: changing published segments violates version immutability; changing only local player state does not persist or help future learners. Separate timing revisions fit the current session pinning model and preserve unrelated draft edits. This implementation choice follows repository constraints.

`PATCH sessions/<id>/timing/` accepts position/start_ms/end_ms/revision, validates strict integer input, audio bounds and neighboring exercise intervals, enforces admin/staff ownership, Easy-only mode and the current published version, and rejects stale timing revisions with 409. Each successful change logs an audit event. Save does not silently trim another exercise.

The UI has accessible start/end inputs, 0.1 second adjustments, preview, save and cancel, with permission/error/loading/success feedback. Preview may include adjacent audio while choosing a boundary; saved intervals must not overlap. Existing answer autosave and navigation remain connected.
