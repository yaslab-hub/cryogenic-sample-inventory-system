# Phase 1 Data Model

## Storage hierarchy
The physical location is modeled as **Stripe → Box → Position**.

A position has a deterministic identifier such as S1-B01-C3.

## Entities
- stripes: id, name, description, created_at
- boxes: id, stripe_id, name, rows (number of rows), columns (array of column letters, for example A–I), created_at
- positions: id, box_id, row_num, col, created_at (unique per box_id, col, row_num)
- samples: id, cell_line, sample_type, passage, cell_count, qc_status (Pending, Passed or Failed), owner, notes, created_at, updated_at
- storage: position_id, sample_id, assigned_at
- activity_log: id, ts, action (CREATE, UPDATE, MOVE, SEED), sample_id, from_location, to_location, actor, details

The storage relation is separate from samples so a sample can be moved without changing its identity.

`activity_log` is a basic append-only record of changes. Detailed audit history remains out of scope for Phase 1 (see `PHASE1_PLAN.md`).

The PostgreSQL schema is in `server/schema.ts`.

## Constraints
- positions.id is unique.
- storage has only current assignments (a move updates the row in place), so every row is an active assignment.
- A position contains zero or one sample: `storage.position_id` is the primary key.
- A sample has at most one position: `storage.sample_id` is unique.
- Both rules are enforced by the database, so concurrent requests cannot double-book a position.
- Moving a sample is one transaction that locks the sample's storage row, checks the target is free, and updates the assignment.
- Search should return the current position.

## Excel migration
Normalize the current Nitrogen Tank Map into Stripe, Box, Position, Sample metadata, and Storage assignment. Retain original location text during migration validation.
