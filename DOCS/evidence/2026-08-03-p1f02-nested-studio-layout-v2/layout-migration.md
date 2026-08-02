# Layout Migration

Storage accepts only recognized, finite V2 values. Valid V1 state is deterministically mapped to V2. Unknown versions, malformed JSON, non-finite sizes, and invalid shapes fall back to the default Edit preset. Migration changes presentation state only and never writes an editor revision or history entry.
