# Media Library V2 — what the panel is, and what it may never do

Gate B of P1-F.1A. Commit: `[verified] feat(media): complete Media Library V2 essentials`.

---

## The one sentence

**The Media panel is a shelf. Putting things on a shelf, and tidying the shelf,
is not editing the video.**

Everything below follows from that sentence.

---

## The shape

```
  ┌──────────────────────────────────────────────┐
  │ Media · 5 assets     Import  Sort  Folder  ⋯ │  MediaHeader        FIXED
  ├──────────────────────────────────────────────┤
  │ [ Search media                    ] [Clear]  │  MediaSearchAndFilter
  │ [All 5][Video 2][Image 2][Audio 1][Missing 0]│                     FIXED
  │ All media · 5 results                        │
  ├──────────────────────────────────────────────┤
  │ ┌────┐ interview.mp4                       ⋯ │  MediaResults
  │ │IMG │ Video · 30 sec                        │
  │ └────┘ 1920×1080 · Used 1 time               │  ◄── the ONLY
  │ ┌────┐ logo.png                            ⋯ │      thing that
  │ │IMG │ Image · Still image                   │      SCROLLS
  │ └────┘ 1200×800 · Unused                     │
  ├──────────────────────────────────────────────┤
  │ logo.png                             Unused  │  selected-asset
  │ [Add at playhead] [Preview] [Remove]         │  actions          FIXED
  └──────────────────────────────────────────────┘
```

### Why only the results scroll

If the whole panel scrolled, then scrolling down to row thirty would carry
Import, Search and Filter off the top of the screen. That is: **the moment a
user has enough media to need to scroll is exactly the moment the tools for
coping with a lot of media become unreachable.** So the header and the toolbar
are pinned and only the list moves.

Held by a test that reads the stylesheet and asserts there is exactly **one**
rule in the whole file with `overflow-y: auto`, and that it is
`.media-bin__results`.

---

## The three-line row

```
  [thumb]  my-interview.mp4                 ← what it is called
           Video · 4:12                     ← what kind, how long
           1920×1080 · Used 2 times         ← how big, where it is used
```

A fixed three-line shape rather than "show whatever this asset happens to have"
is what lets a person scan forty rows: **the third line is always the one that
says whether it is in the video**, so the eye learns one place to look.

When a fact does not exist — a sound file has no picture size — the slot says
something true and short (`Sound only`) rather than collapsing and shifting the
line below it.

When the source is in trouble the third line carries **both** facts:
`800×600 · Missing media · Used 1 time`. Dropping the usage there would remove
exactly the fact that decides how urgent the problem is.

Never colour alone: *missing* is bold **and** underlined **and** says the words
"Missing media"; *selected* gets a border, an outline, and `aria-selected`.

No raw filesystem path is ever shown. No internal asset id is ever shown.

---

## What is presentation, and what that guarantees

| Thing | Where it lives | Touches the project? |
|---|---|---|
| Search text | screen state | no |
| Kind filter | screen state | no |
| Sort field and direction | screen state | no |
| Which folder you are in | screen state | no |
| The folders themselves | **server file** beside the project | no |
| Which asset is selected | screen state | no |
| Importing a file | server, adds an asset | adds an asset, **not an edit** (ADR-007) |
| "Add as B-roll" / "Add as music" | server, one operation | **yes** — a real edit |

Proved end to end in the real browser on 2026-08-03: create a folder, be refused
a duplicate name, rename, move an asset in, move it back, delete the folder —
and the project came out **byte-identical**.

```
  before all folder work   revision 4  changeSets 0  assets 5
                           sha256 39e6e054…27389d84
  after all folder work    revision 4  changeSets 0  assets 5
                           sha256 39e6e054…27389d84   ← identical
```

Because the revision did not move, the export idempotency key
`sha256(projectId : revision : renderPlanSchemaVersion)` did not move either, so
a re-export re-uses the finished MP4 instead of spending 60–90 seconds
re-encoding a video nobody changed.

---

## Presentation state is owned by the screen, not by the panel

The Media panel is **unmounted and rebuilt** by ordinary things the user does —
switching from Edit to Colour, changing workspace. React throws away the state
of an unmounted component.

If the search text lived inside the panel, every one of those actions would
silently clear it, and the user would have no idea why. So it is one object
(`MediaPresentationState`) owned by `StudioScreen`, which stays mounted, handed
down as a single prop.

One prop rather than nine also means adding a tenth piece of presentation state
later does not widen the panel's interface.

---

## Import

One button, four choices, **one hidden file input**.

| Choice | What the file dialog will show |
|---|---|
| Video | MP4, MOV, WebM, MKV |
| Image | PNG, JPEG, WebP, BMP, GIF, TIFF |
| Audio | MP3, M4A, AAC, FLAC, OGG, WAV |
| All supported media | the union of those three |

These are **truthful**: they are exactly the types the API can hand back to the
browser (`contentTypeFor` on the server). A wildcard `accept="*"` was rejected —
a dialog that lets a user pick a spreadsheet and then refuses it a second later
has taught them the product is unreliable, when in fact it never could have
worked.

Four choices share **one** input because four inputs would be four places for a
duplicate upload handler to hide. The `accept` attribute is set directly on the
element rather than through React state, because the dialog has to open inside
the same user gesture — a state update would not have applied yet and the user
would get the previous choice's filter.

**The server remains the authority.** It decides what a file is by looking at
its bytes with ffprobe, never by its name. The client-side check is only a fast
"no" for things that are plainly not media, so nobody watches a progress bar
fill up for a PDF.

Duplicate uploads are blocked by a `ref`, not by the busy flag: two file-chooser
events in the same frame both read the old state, so only a ref can stop the
same bytes being sent twice.

---

## Operating-system file drop

Files dropped onto the **results region** are imported. Not the whole panel —
so a file released over the Import button or the search box is not swallowed by
an invisible full-panel catcher.

A mixed drop is split: what can be sent is sent, and **each refusal names its
own file**. "Some files were not supported" leaves the user to work out which,
and with ten files that is not a reasonable thing to ask.

Real browser, 2026-08-03 — dropping `budget.pdf` + a PNG together:

```
  imported   1 file imported.
  refused    budget.pdf is not a video, a picture, or a piece of music
             (application/pdf).
```

The drop highlight is counted in and out (drag enter/leave fire for every child
element crossed), so it does not flicker off as the pointer moves over a row
inside the very region being dragged across. It clears on leave, on drop, and on
cancel.

A drag that is **not** files is ignored, so the Gate C timeline drag can never be
mistaken for an import.

---

## Object URLs

The Media panel creates **none**. Every thumbnail and preview link is a server
URL under `/api/projects/…/assets/…/media`. Verified in the real browser:

```
  object URLs in the Media panel:  0
  failed HTTP requests:            0
  console errors:                  0
```

There is nothing to leak, which is a stronger guarantee than remembering to
revoke.

---

## Deliberately not in Gate B

- Media-to-Timeline drag is **built and tested but switched off**. See
  `media-drag-contract.md`.
- Multiselect and batch actions.
- Nested folders, tags, ratings, favourites, smart folders.
- Asset deletion. It does not exist, so it is not offered — there is no
  greyed-out "Delete" teaching the user that half the product does not work.
  The one disabled entry is "Remove", kept visible **with its reason attached**,
  because the user can already see the media is in their video and needs to be
  told why it cannot go.
