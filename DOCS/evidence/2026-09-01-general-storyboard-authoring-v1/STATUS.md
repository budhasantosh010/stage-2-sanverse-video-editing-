# General Storyboard Authoring Surface V1 — evidence

Date: 2026-09-01
Branch: `external-mcp-raw-video-v1`
Status: **implementation + automated/client acceptance complete; separate REQ-020 human raw-video release gate remains open**

## Result

Sanverse external agents can now inspect and author the canonical Motion Graph inside the existing Storyboard sandbox instead of being limited to narrow template fields. The same revision, lock, owner-approval, production-apply and Undo/Redo authorities remain in force.

The final MCP registry exposes **69 tools**. General Storyboard authoring includes typed graph/schema inspection, revision-fenced multi-KVS graph/design transactions, KVS/presentation controls, reopen, hard/soft style QA, content-binding refusal, bounded complexity and exact approved-Storyboard structural handoff into Motion Forge.

Storyboard chat review now renders the exact KVS source frame whenever source video is visible, composites the current canonical graph/treatment over that frame, attaches the verified images directly to STDIO chat, and includes compact semantic design diffs plus QA/revision context.

## Deterministic real-project STDIO acceptance

`stdio-authoring-audit.json` records a real run against project `project_21c01709e413d034d4cec25dcb4b1ca4` with accepted production revision `0`:

- 69 tools discovered;
- `$29` authored to `£29` through canonical `set-property`;
- canonical shape authored to `ellipse` through `set-node-static-property`;
- major structural redesign duplicated a graph node and added a semantic part;
- final sandbox revision `4`;
- 2 KVS review states and 2 source-composited review artifacts;
- 6 image items attached across the returned STDIO review content;
- exact source-frame mapping verified as `sourceStartTick + localTick`;
- semantic review context verifies the authored `£29` and `ellipse` values;
- accepted production revision remained unchanged.

## Real Codex 0.144.1 acceptance

A fresh real Codex process used only the Sanverse MCP and completed the owner-level authoring goal without source-code, manual graph-file, production-apply or export edits.

Final marker:

`SANVERSE_CODEX_AUTHORING_OK run_id=run_01ehbqzl scene_id=creative_scene_01srm0io review_id=review_00nry3ss image_count=2`

The successful client session:

- selected the production project and captured the accepted revision;
- attached a timed SRT and completed source analysis/opportunity planning;
- created and inspected a Storyboard scene;
- selected text node `values.item:0` and shape node `component.background` at sandbox revision `1`;
- applied revision-fenced canonical text and shape transactions;
- re-inspected at sandbox revision `3` and explicitly verified Unicode code point `163` (`U+00A3`) immediately before `29` plus `ellipse` in every relevant KVS state;
- prepared Storyboard review and received 2 source-composite images in chat;
- re-read production context and confirmed the accepted production revision did not change.

One attempted graph call in that successful Codex session was typed-refused before Codex corrected its arguments and completed the two valid transactions. Earlier bounded Codex attempts also exposed model/tool-input construction failures. They are retained in `FAILURES.md`; they did not mutate production and are not hidden as successful calls.

## Continuation

`npm run sanverse:mcp:audit-continuation` passes with **69 tools** on two independent STDIO processes. Process A closes before process B starts; process B restores the same durable `run_00n2km2k` / `review_000cuypa` stage, evidence hash, three artifact identities and chat images with no production mutation or handshake-timeout evidence.

## Regression/build gate

Authoritative Windows single-fork root test command:

`npm test -- --run --pool=forks --poolOptions.forks.singleFork=true`

exits `0`. Key surfaces in this exact run include Web **1,239/1,239**, API **411/411**, Edit Domain **491/491**, Motion Library **202/202**, Motion Graph **148/148**, Render Contract **120/120**, Creative Production Adapter **35/35**, Motion MCP **30/30**, Motion Agent Tools **30/30**, and Motion Storyboard **16/16**.

The root all-workspace production build exits `0`. Final hygiene also passes: `git diff --check`; 0 `sites/**` changes; 0 raw-media additions; 0 private-path additions; 0 secret-like added lines. `npm audit --omit=dev --json` reports 0 info / 0 low / 0 moderate / 0 high / 0 critical vulnerabilities.

## Human release boundary

This slice does **not** create the immutable `sanverse-external-mcp-raw-video-v1` release tag. REQ-020 still separately requires the meaningful spoken-video/ten-scene representative benchmark, legitimate human Storyboard/timing/Motion review and actual 1× watch of the complete final export. General authorization to finish engineering does not fabricate unseen visual-review evidence.
