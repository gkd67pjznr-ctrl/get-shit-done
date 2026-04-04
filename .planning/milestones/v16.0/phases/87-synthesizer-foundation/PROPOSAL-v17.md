# Proposal — v17.0 Test Milestone

*Generated: 2026-04-04*
*Status: Awaiting synthesis — phase numbers not yet assigned*

## Phases

- **PHASE-A: Auth Foundation** — Basic auth plumbing
- **PHASE-B: Session Management** — Token lifecycle

## Phase Details

### PHASE-A: Auth Foundation
**Goal**: Users can authenticate with the system
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02
**Success Criteria** (what must be TRUE):
  1. User can log in with valid credentials
  2. Invalid credentials are rejected with a clear error

### PHASE-B: Session Management
**Goal**: Sessions persist correctly across restarts
**Depends on**: PHASE-A
**Requirements**: AUTH-03
**Success Criteria** (what must be TRUE):
  1. Token is refreshed automatically before expiry
