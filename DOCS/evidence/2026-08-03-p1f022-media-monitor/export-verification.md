# Export verification

Real browser path: select Point, create `Monitor V1 proof`, accept, Undo, Redo, Export.

Result: edit/Undo/Redo succeeded and one video remained. Export entered the real rendering state but did not resolve to download or failure within 90 seconds. Unit/integration export lifecycle coverage still passes, but this real runtime probe is not claimed as a successful export. One-line next action: separately diagnose the export job/API lifecycle with server job identifiers and bounded timeout instrumentation.
