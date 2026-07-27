# Evidence — the real provider adapter (G4B-12A, 12B, 13A)

Date: 2026-07-27
Evidence level: **E3** — real HTTP over real sockets, plus the real browser loop
on the owner's own project. **Not E4/E5:** no packet has reached NVIDIA,
opencode, OpenRouter, or LM Studio.

## What was built

Per DEC-011: one adapter speaking the OpenAI chat-completions HTTP shape, with
no per-provider branch anywhere.

```
apps/api/src/intent/
  intent-provider-config.ts     environment -> configuration -> port
  openai-compatible-adapter.ts  the one real adapter
  + intent-provider-config.test.ts          20 tests
  + openai-compatible-adapter.test.ts       29 tests
  + real-provider-integration.test.ts        9 tests (real sockets)
packages/intent-domain/src/intent-candidate.ts
  NAMEPLATE_ARGUMENT_KEYS now exported, so the model instruction is generated
  from the same constant the validator enforces
```

## Verified by running it

### Real HTTP, real sockets (`real-provider-integration.test.ts`)

A stub server speaking the chat-completions shape, driven through the whole
chain: environment variables, configuration, adapter, sockets, envelope, closed
validator, operation builder, change set.

| Case | Result |
|---|---|
| Valid model reply | Pending proposal, `source: ai`, 3 s honoured, point taken from the click |
| What crossed the wire | Exactly the six allowlisted keys. Project ID, clip ID, filename, and file hash all absent from the request body |
| Smuggled capability `sanverse.shell.run/v1` | `rejected / CAPABILITY_NOT_ALLOWED` |
| Extra key `shellCommand` | `rejected / PROVIDER_RESPONSE_INVALID` — refused whole, never stripped |
| Clarification reply | Passed through as a question |
| Prose reply | `rejected / PROVIDER_RESPONSE_INVALID` |
| HTTP 401 | User told "not responding"; log carries `HTTP 401`; the typed sentence is absent from the log |
| Proxy not running (port 1) | `rejected / PROVIDER_UNAVAILABLE`, "Your video is unchanged." |
| Server accepts and never replies | Abandoned at the timeout, project untouched |

### Real browser, owner's project (`project_c6121ed2…`)

Servers restarted so the new code was actually running. Startup printed:

```
AI provider: fake (deterministic, offline). Nothing leaves this machine.
```

1. Asked without pointing → "Where should it go? Choose Point, then click the
   spot." No proposal created.
2. Pointed, asked again → proposal `Priya` / `Head of Design`,
   `Here · 00:00.000 · 3 seconds`, labelled "Suggested by the assistant", note
   "Placed where you pointed."
3. Export and the chat box both closed while the proposal was pending.
4. Accepted → on disk, `revision: 11`, three change sets:

```
direct   active=True  text=Sanverse Video editing  req=
ai       active=True  text=Santosh                 req=request_8456a4c886df16af…
ai       active=True  text=Priya                   req=request_e58c2da759fc45e4…
```

Zero browser console errors. Zero server errors.

## Test and build state

```
  edit-domain      103
  render-contract   22
  intent-domain     27
  api              162   (was 103)
  web              160
  ------------------------
  total            474 passing; all workspace builds clean
```

## Limitations — what this does NOT prove

- **No real provider has been called.** NVIDIA, opencode, OpenRouter, and LM
  Studio remain untested. A stub cannot reproduce a real model's wording,
  latency, quota behaviour, or schema drift.
- **LiteLLM is not installed**, so its request-body logging has not been
  verified off. That check (G4B-12C) is mandatory before the first real call.
- **opencode's gateway shape is still unverified**, recorded from the owner's
  instruction rather than from a test.
- The `<think>` and code-fence unwrapping is written against how reasoning
  models are documented to behave, not against an observed NVIDIA response.
