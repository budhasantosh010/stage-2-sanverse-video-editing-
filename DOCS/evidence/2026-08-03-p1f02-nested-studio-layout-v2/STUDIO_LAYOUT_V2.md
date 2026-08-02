# Studio Layout V2

The root horizontal group owns `AI | main editor`. The main editor contains a vertical `upper workspace | timeline` group. The upper workspace contains `media | preview | tool`. Every direct group child is a panel or separator from the same layout library.

Layout state is presentation-only. StudioScreen remains the adapter to the single existing editor session. Layout events cannot create domain revisions or history entries.

Presets are Edit, Motion, Timeline, Review, AI, and Audio. Manual resizing changes the preset marker to custom. Reset restores the active preset. Persisted values are applied only after migration and validation.
