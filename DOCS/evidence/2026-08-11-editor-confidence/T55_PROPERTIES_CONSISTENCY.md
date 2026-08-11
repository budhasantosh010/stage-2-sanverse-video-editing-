# T5.5 Properties Consistency

## Shared numeric language

`InspectorNumberField.tsx` replaces duplicated local numeric-field implementations in editorial and visual Inspector sections.

Behavior:

- numeric entry with min/max clamping;
- normal declared step;
- Shift+Arrow = 10× declared step;
- Enter exits/blurs the numeric field;
- non-finite text does not become a project value;
- the field edits the existing Inspector draft only.

## Apply semantics

Existing safe semantics are preserved:

- direct manipulation commits on release through existing authorities;
- multi-field Inspector forms remain explicit Apply/Reset transactions;
- dirty sections now state `Changes not applied yet.` so draft and accepted state cannot look identical;
- existing dirty-draft reconciliation before selection changes remains authoritative.

New `InspectorConfidence.test.tsx` covers larger-step input, clamping, visible dirty state and clean-state Apply disablement.
