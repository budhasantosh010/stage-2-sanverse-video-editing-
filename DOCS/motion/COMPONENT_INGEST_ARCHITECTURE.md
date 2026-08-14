# Sanverse Approved Component Ingest V1

Date: 2026-08-14
Status: **Infrastructure implemented and CH1 batch completed locally: 10/10 approved components productized, parity verified and registered; public catalog 99.**

## Mission

Visual agents may create different art and use different implementation techniques, but Sanverse accepts them through one engineering boundary:

```text
owner-approved external visual
        ↓
motion:inspect
        ↓
source classification + approval/determinism/security gate
        ↓
motion:ingest
        ↓
immutable approved-source snapshot + hashes
        ↓
motion:productize
        ↓
canonical props + semantic Motion Graph + exposure map
        ↓
approved original ↔ integrated parity
        ↓
owner parity authority
(direct review OR explicit batch-authorized engineering parity)
        ↓
motion:register
        ↓
public Motion registry = Creative Library catalog
```

Productization may change implementation architecture. It may not aesthetically reinterpret an approved component.

## Source lanes

The closed source-kind contract is `sdk-native | sdk-custom | procedural | shader | hybrid | foreign`.

- **Native lane:** supported SDK source can materialize directly into ordinary Motion Graph structures.
- **Expert lane:** custom/procedural/shader/hybrid source keeps genuinely expert portions behind typed expert boundaries rather than exploding them into meaningless ordinary nodes. C6 is not yet available, so V1 classifies and records this lane but does not claim a C6 end-to-end pilot.
- **Foreign lane:** foreign React/HTML/SVG/Canvas/WebGL/etc. is quarantined and analyzed. It may be losslessly normalized, use an approved expert wrapper when available, be returned to its visual author for source adaptation, or be marked incompatible. “Close enough” recreation is not a valid outcome.

## Fail-closed stages

### `npm run motion:inspect -- "<component-directory>"`

Validates identity from metadata rather than folder name, owner approval + visual lock, canonical ticks, direct-seek claim, runtime confinement, obvious wall-clock/random render authorities, duplicate public IDs, dependency metadata, semantic parts and source classification. Inspection does not mutate the repository.

### `npm run motion:ingest -- "<component-directory>"`

Requires inspection success and writes only to staging under:

`motion/component-intake/<component-id>/`

`original/` is a hash-guarded copy of the approved source evidence. Reference media, extracted source-video frames and other third-party evidence are excluded. `reports/` stores inspection/integration records. Public registry remains unchanged.

### `npm run motion:productize -- <component-id>`

Loads a repository-side productization descriptor and validates one canonical component definition through all requested ratios, same-tick and backward/random direct-seek equality, semantic mapping, C3 Layers, C4 Timeline, C5 Curves and typed AI-edit exposure IDs.

### `npm run motion:parity -- <component-id>`

Shows source hash, golden-review hash, engineering parity evidence and whether registration is allowed. A numeric image metric is supporting evidence only; synchronized visual review remains authority. Direct manual owner review is recorded with `npm run motion:parity -- <component-id> --owner-approve`. When the owner has already approved a bounded source set and explicitly authorized the coding agent to preserve, self-verify and insert the remaining integrations, the distinct `--owner-batch-authorize` promotion records `owner-batch-authorized-engineering-evidence`. Both promotions refuse unless engineering parity evidence already passed; ordinary engineering evidence alone cannot register.

### `npm run motion:register -- <component-id>`

Registration is atomic and refuses unless productization, determinism, direct seek, semantic mapping, C3/C4/C5, AI editability, a canonical golden review and **owner-authorized integrated visual parity** all pass. Owner authority is either a direct synchronized parity review or the explicit batch-authorized engineering-parity state above. Only then does registration update the generated ingested registry and registration ledger.

## Immutable evidence

Every intake records SHA-256 hashes for the approved package files. A pre-existing intake path with different bytes is rejected instead of overwritten. This lets Sanverse prove exactly which owner-approved visual became a canonical component.

The source snapshot intentionally contains only reusable component material, not the reference creator footage that inspired it.

## Graph authority

An integrated component has one Motion Scene authority. C3, C4 and C5 are projections of that same graph; the ingestion layer does not add a parallel layer tree, timeline, curve store or animation clock.

For foreign timing functions that cannot be represented by the existing expression vocabulary without changing motion, a small deterministic graph primitive may be added only when it has a precise mathematical definition. The first pilot required the already-known Back easing formula, so `back-out(input, overshoot)` was added to the scalar expression contract and evaluated using the existing `easeOutBack` primitive.

## AI editability

Normal AI edits target stable component/node/exposure identity and typed operations. They do not open source files and rewrite implementation code. Creator controls stay semantic; lower-level graph data remains available to advanced/compositor tools.

## Public-registry invariant

`MOTION_COMPONENT_CATALOG` consumes a generated ingested registry. Productized pilots do not enter it automatically. Registration is the only ingest stage allowed to add an external component to the public catalog, preserving:

```text
public Motion registry == public Creative Library catalog
```

## CH1 completion

CH1 Components 01–10 classify as `foreign → lossless-normalization → foreign-adapter`. They share one approved deterministic HTML/CSS/JS runtime, but each becomes an independent public Sanverse component with its own definition, props, stable semantic graph, exposures, duration and review evidence.

Component 01 established the first-pilot contract and received direct owner parity approval. Components 02–10 then reused the same fail-closed pipeline under the owner's explicit batch authorization.

Final CH1 status:

- source approval: 10/10 PASS;
- immutable snapshot/hash: 10/10 PASS;
- deterministic/direct seek: 10/10 PASS;
- four ratios + reduced motion: 10/10 PASS;
- C3/C4/C5 + AI editability: 10/10 PASS;
- exact-tick temporal parity: 10/10 PASS;
- owner authority: Component 01 direct owner review; Components 02–10 batch-authorized engineering parity;
- public registration: 10/10 REGISTERED;
- real Creative Library 1× playback: 10/10 PASS;
- public catalog count: 99.

The Creative Library exposes the ten entries through the `CH1` milestone and `owner-approved-ch1` collection with fresh posters and durable passed reviews.

Evidence: `DOCS/motion/evidence/COMPONENT-INGEST-V1.md`.

## Boundaries

- `apps/web` is untouched.
- No GitHub push/actions are used.
- A22, B2/B3 and C6 are not started.
- C6 readiness is recorded as `not-yet-available`, never faked.
- CH1 is complete; future external visual sets must still pass the same fail-closed intake/productization/parity/authorization/registration sequence rather than inheriting CH1 approval.
