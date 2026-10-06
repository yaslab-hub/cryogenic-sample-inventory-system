# Phase 1 — Core Inventory System

## Goal

Replace the current Nitrogen Tank Map spreadsheet workflow with a web-based cryogenic sample inventory system.

Phase 1 focuses on the minimum complete workflow needed for daily laboratory use:

**Storage Map → Sample → Search → Add/Edit/Delete → Move → Find Empty Position**

## Scope

### 1. Storage hierarchy

- Stripe
- Box
- Position
- Fixed position coordinates (row/column)
- Occupancy status

### 2. Sample inventory

Each sample should be stored as structured data rather than free-form cell text.

Core fields:
- Sample ID
- Cell Line
- Sample Type
- Passage
- Cell Count
- QC Status
- Owner
- Location
- Notes
- Created/Updated timestamps

### 3. Visual Tank Map

- Stripe selector
- Box selector
- Grid-based position map
- Occupied / empty visual states
- Click a position to view sample details
- Position identifier such as S1-B01-C3

### 4. Sample CRUD

Users can:
- Add a sample to an empty position
- Edit sample metadata
- Delete/remove a sample
- View complete sample details

### 5. Move Sample

Users can move a sample between valid empty positions.

Every move should update the current location consistently.

### 6. Search

Global search across:
- Sample ID
- Cell line
- Sample type
- Owner
- Location

Search results should link directly to the sample and its storage position.

### 7. Find Empty Position

Users can filter by Stripe / Box and find available positions.

The system must never allow two active samples to occupy the same position.

## Suggested data model

- `stripes`
- `boxes`
- `positions`
- `samples`
- `storage`

For Phase 1, an activity log is recommended as a lightweight foundation but detailed audit/history features can remain Phase 2.

## Phase 1 milestones

### P1 — Project foundation
- Establish frontend stack and project structure
- Define data model
- Define storage-map coordinate convention
- Add basic application shell/navigation

### P2 — Storage Map
- Stripe/Box selectors
- Position grid
- Occupancy rendering
- Position detail panel

### P3 — Sample Inventory
- Sample list
- Search
- Add sample
- Edit sample
- Remove sample

### P4 — Location Operations
- Move sample
- Empty-position finder
- Position validation

### P5 — Import & validation
- Prepare migration format for the existing Nitrogen Tank Map Excel
- Validate imported Stripe/Box/Position/Sample relationships
- Seed representative test data

## Phase 1 acceptance criteria

- A user can navigate from Stripe → Box → Position.
- Every position has a unique, deterministic identifier.
- A user can add a sample to an empty position.
- A user can edit or remove a sample.
- A user can search for a sample and immediately see its location.
- A user can move a sample to another empty position.
- Occupied positions cannot be double-booked.
- Empty positions can be found without opening the spreadsheet.
- The UI works on desktop and a basic mobile layout.
- Existing Excel data can be mapped into the Phase 1 data model without losing the original location information.

## Explicitly out of scope for Phase 1

- QR code scanning
- Detailed activity/audit history
- Authentication/role permissions
- Freeze/thaw history
- Notifications/reminders
- Advanced analytics
- Automated Excel synchronization

These belong to later phases after the core workflow is stable.
