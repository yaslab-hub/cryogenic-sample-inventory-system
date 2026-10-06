# Phase 1 Data Model

## Storage hierarchy
The physical location is modeled as **Stripe → Box → Position**.

A position has a deterministic identifier such as S1-B01-C3.

## Entities
- stripes: id, name, description, created_at
- boxes: id, stripe_id, name, rows, columns, created_at
- positions: id, box_id, row, column, created_at
- samples: id, cell_line, sample_type, passage, cell_count, qc_status, owner, notes, created_at, updated_at
- storage: position_id, sample_id, assigned_at

The storage relation is separate from samples so a sample can be moved without changing its identity.

## Constraints
- positions.id is unique.
- storage.position_id is unique for active assignments.
- An active sample has at most one active storage assignment.
- A position contains zero or one active sample.
- Moving a sample should atomically release the old position and assign the new position.
- Search should return the current position.

## Excel migration
Normalize the current Nitrogen Tank Map into Stripe, Box, Position, Sample metadata, and Storage assignment. Retain original location text during migration validation.
