# ADR-MEDIA-ORGANIZATION-V1 — where a user's filing of their media lives

- Status: Accepted
- Date: 2026-08-03
- Gate: P1-F.1A Gate B — Media Library V2 Essentials
- Extends: ADR-006 (sidecars), ADR-007 (assets), ADR-005 (anchoring)

---

## The question

The user can now put media into one level of folders. **Where does that filing
live, and what kind of thing is it?**

This has to be answered before any folder code, because the wrong answer is very
expensive to undo: it would either make "rename a folder" appear in Undo history
next to "cut four seconds", or make folders vanish when the browser's storage is
cleared, or make a re-export re-render an identical video because a folder name
changed.

---

## Context: this codebase already distinguishes two kinds of thing

```
  A DECISION ABOUT THE VIDEO          EVIDENCE / WORKING CONTEXT
  ──────────────────────────────      ──────────────────────────────────
  "cut 4 seconds off the front"       what was said in the recording
  "put my name on screen"             which file the user thinks is the
  "play this song underneath"          good take
  ──────────────────────────────      ──────────────────────────────────
  changes what is exported            changes NOTHING that is exported
  is an EditOperation                 is not an operation at all
  goes in an atomic change set        travels beside the project
  creates a revision                  creates no revision
  Undo walks back through it          Undo must NOT walk back through it
  lives in EditProject                lives in a SIDECAR
```

ADR-006 already made this call once, for transcripts: *"the transcript is
evidence about footage, not a decision the user made, and undoing an edit must
not undo the knowledge of what was said."*

**Putting a file into a folder is the same kind of thing.** It changes not one
pixel and not one millisecond of the exported video. It is how the user keeps
track of their own material.

---

## Decision

### 1. Ownership — a project-owned server sidecar

Media organisation is stored by the **API, on disk, next to the project**:

```
  .sanverse-data/projects/<projectId>/
    ├── source.mp4                  the footage, immutable
    ├── assets/<assetId>            everything else brought in
    ├── project.json                EditProject — the DECISIONS
    ├── media-organization.json     THIS — the user's filing        ← new
    └── exports/                    finished MP4s
```

Read through `repository.readMediaOrganization(projectId)`, written through
`repository.saveMediaOrganization(projectId, serialized)`, in exactly the style
of the existing `readProjectState` / `saveProjectState`.

**Rejected: `localStorage`.** It is per-browser, per-origin, silently cleared,
and invisible to the server. The owner would file twenty clips into folders,
clear their browser data, and find the filing gone with no warning and no way to
recover it. This is named as a review blocker in the gate specification and it
is correct that it is.

**Rejected: inside `EditProject`.** Three consequences, each bad:

```
  1. Undo becomes useless as an editing tool.
     Undo would step back through "renamed a folder" on its way to
     "removed that cut" — furniture mixed with decisions.

  2. Re-export re-renders for nothing.
     The export idempotency key is
         sha256(projectId : revision : renderPlanVersion)
     A folder rename bumping the revision changes that key, so the next
     export re-encodes a byte-identical video. On this machine that is
     60-90 seconds of wasted CPU for renaming a folder.

  3. It contradicts the closed render contract.
     compileProjectToRenderPlan would have to receive, and then ignore,
     data that can never affect a pixel. Data the compiler must ignore
     should not be in the compiler's input.
```

**Rejected: a separate database.** No other part of this product needs one. A
single JSON file written atomically (temp file, then rename) matches how
`project.json` and export jobs are already stored, and inherits their durability
and their crash behaviour.

### 2. Shape — one closed contract

```ts
type MediaFolderV1 = Readonly<{
  folderId: string      // ^folder_[a-z0-9]{8,64}$ , opaque, server-generated
  name: string          // 1..64 chars after trimming, unique case-insensitively
  createdAt: string     // ISO 8601
}>

type MediaOrganizationV1 = Readonly<{
  schemaVersion: 'sanverse.media-organization/v1'
  folders: readonly MediaFolderV1[]                    // max 32
  assetFolderAssignments: Readonly<Record<string, string>>  // assetId -> folderId
}>
```

- **Root is implicit.** There is no root folder object. An asset with no entry
  in `assetFolderAssignments` is at the root. This makes "move back to root" a
  deletion of one key rather than a second concept that can disagree with the
  first, and it means a brand-new project needs no migration at all.
- **No nesting.** A folder has no parent field, so a tree cannot be represented
  and therefore cannot accidentally be created. One level is the whole scope.
- **IDs are opaque and stable.** Renaming a folder changes `name`; every
  assignment keeps pointing at the same `folderId`. Names are the user's
  language and may change freely; identity never does.
- **Names are normalised and unique.** Compared after trimming and case-folding,
  so "B-roll" and "b-roll " cannot both exist and leave the user unable to tell
  two folders apart.

### 3. Closed key sets and refusal, as everywhere else

Following the standing rule (refuse, never silently repair):

| Situation | Answer |
|---|---|
| unknown top-level key | **refuse** the whole document |
| unknown `schemaVersion` | **refuse** |
| assignment naming an unknown `folderId` | **refuse** |
| assignment naming an assetId the project does not have | **refuse** |
| duplicate folder name after normalising | **refuse** the command |
| name longer than 64 characters | **refuse** the command |
| more than 32 folders | **refuse** the command |
| the file is absent | **not an error** — the empty organisation |
| the file is corrupt or unparseable | **refuse to load**, surface it, and leave the file untouched |

The last row deserves its reason. Silently replacing a corrupt organisation file
with an empty one would tell the user their filing "just disappeared". Refusing
loudly keeps the bytes on disk so they can be recovered.

The one deliberate softening: **an assignment whose asset was removed from the
project is dropped on load, not refused.** Assets can legitimately leave a
project; a stale pointer to one is not corruption, and refusing the whole
document over it would lock the user out of all their filing because of one gone
file.

### 4. Typed commands, never arbitrary mutation

Five validated commands, each taking the current organisation and returning
`Result<MediaOrganizationV1, MediaOrganizationError>`:

```
  createFolder(name)
  renameFolder(folderId, name)
  moveAssetToFolder(assetId, folderId)
  moveAssetToRoot(assetId)
  deleteFolder(folderId)          -> its assets return to the root
```

Pure functions in the domain, with no I/O and no React. The browser calls them
through an API route; the file is written only after the result validates.

`deleteFolder` returning assets to the root rather than deleting them is
deliberate: **a folder is a label, not a container.** Deleting a label must
never be able to delete the user's material. Asset deletion is out of scope for
this gate entirely.

### 5. Why typed commands, when nothing else calls them yet

Because something will. The standing rule from ADR-004 is that a person clicking
a button and an AI acting on a sentence must go through **the same validated
path**. "Put all the B-roll in one folder" is an obviously reasonable future
request. If organisation were mutated by ad-hoc JSON patching in a React
component today, that future would require either a second implementation or a
rewrite.

The commands are shaped now so an AI capability can be registered against them
later without changing them. **No such capability is registered in this gate**,
and the AI cannot reach media organisation today.

### 6. Explicitly: organisation never touches the render

This is the load-bearing guarantee and it is structural, not a promise:

```
  MediaOrganizationV1  ──X──>  EditProject
                       ──X──>  compileProjectToRenderPlan
                       ──X──>  RenderPlan
                       ──X──>  FFmpeg
```

`compileProjectToRenderPlan` takes an `EditProject`. Media organisation is not
in an `EditProject` and is not passed to the compiler, so there is no expression
anywhere that could let a folder change an exported frame. Sorting and filtering
are ordinary local presentation state and never leave the browser.

A test asserts that every one of the five commands leaves the compiled render
plan byte-identical.

### 7. Migration and defaults

There is nothing to migrate. Version 1 is the first version, and its absence is
a valid, meaningful state:

```
  no media-organization.json  ==  { folders: [], assetFolderAssignments: {} }
                              ==  every asset is at the root
```

Every existing project therefore opens correctly with no upgrade step and no
write. The file is created the first time the user makes a folder.

A future v2 (nesting, tags, colours) must add a version and a ladder that fails
closed, exactly like the project schema ladder.

### 8. Collaboration consequences, stated now

Today Sanverse is single-user and local. Two consequences follow from putting
organisation on the server rather than in the browser, and both are wanted:

- **It is per-project, not per-person.** When two people eventually open the
  same project, they see the same filing. That is the right default for a shared
  editing project; a private per-person view would need its own contract.
- **Last write wins, with no merge.** The whole document is replaced atomically.
  With one user this is invisible. With two simultaneous editors, one could
  overwrite the other's newly created folder. That is acceptable now, and the
  fix when it matters is the same revision-fencing already used for change sets
  — a `baseRevision` on the organisation document. **It is deliberately not
  built now**, because building fencing for a case that cannot occur is exactly
  the speculative complexity the architecture gate rejects.

---

## Consequences

**Gained**

- Filing survives clearing browser data, a different browser, and a reinstall.
- Undo remains purely a list of editing decisions.
- A folder rename cannot cause a re-render.
- One level, enforced by a shape that cannot express two.
- The path an AI would later use already exists and is already validated.

**Given up, deliberately**

- **Folder changes are not undoable.** Deleting a folder cannot be reversed with
  Ctrl+Z. This is accepted because the assets return to the root and nothing is
  lost — the worst case is re-creating a label. Making it undoable would require
  a second history, which is precisely the "second authority" this program
  forbids.
- **Organisation is not in the portable archive** unless it is added there
  later. Restoring an archive today restores the video and the edits, not the
  filing. Recorded as a known limitation rather than quietly assumed.
- **No merge on concurrent writes**, as above.
- One extra file and two extra API routes per project.

---

## What would make this decision wrong

If organisation ever needed to affect the exported video — say a folder meaning
"mute everything in here" — this ADR would have to be reopened, because that
would make it a decision about the video and it would belong in `EditProject`
as a real operation. Nothing in this gate does that, and nothing should be added
that does without revisiting this document first.
