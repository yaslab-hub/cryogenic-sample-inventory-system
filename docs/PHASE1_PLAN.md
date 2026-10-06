# Phase 1 — Core Inventory System

## Goal
Replace the current Nitrogen Tank Map spreadsheet workflow with a web-based cryogenic sample inventory system.

**Storage Map → Sample → Search → Add/Edit/Delete → Move → Find Empty Position**

## Scope
- Storage hierarchy: Stripe → Box → Position
- Visual storage map
- Structured sample inventory
- Sample search
- Add / edit / remove sample
- Move sample
- Find empty position
- Excel migration preparation
- Basic responsive UI

## Milestones
1. P1 — Project foundation
2. P2 — Storage Map
3. P3 — Sample Inventory
4. P4 — Location Operations
5. P5 — Import & validation

## Acceptance criteria
- Unique position IDs
- No double-booking of positions
- Search returns sample + location
- Samples can be added, edited, removed, and moved
- Empty positions are discoverable
- Existing Excel locations can be represented without data loss
- Basic mobile layout works

## Out of scope for Phase 1
- QR scanning
- Detailed audit history
- Authentication / role permissions
- Freeze/thaw history
- Notifications
- Advanced analytics
- Automated Excel synchronization
