# T5.5 Error and Refusal Language

Representative Timeline/Studio refusal paths were audited for creator-facing language. Existing production routes already use messages such as:

- `Choose an empty space on the video track first.`
- `Nothing you have picked is part of a group.`
- plain explanations for unsupported cuts, unavailable media, save recovery and export failure.

T5.5 did not replace closed domain refusals; it preserves their authority while keeping ordinary UI free of operation IDs, schemas, project JSON and stack traces. Existing Studio tests for recoverable playback, unsupported edits, save states, export progress/failure and disabled actions remain green.
