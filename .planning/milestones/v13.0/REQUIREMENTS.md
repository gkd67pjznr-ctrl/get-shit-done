# Requirements: GSD Enhanced Fork — v13.0 Unified Observability & Context Routing

**Defined:** 2026-04-04
**Core Value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.

## v13.0 Requirements

### Event Journaling

- [ ] **JRNL-01**: Central `emitEvent(type, context, data)` function writes structured events to `workflow.jsonl` with phase, plan, task, session_id, and timestamp fields
- [ ] **JRNL-02**: Event emitter integrated into gate-runner, correction hooks, workflow observe steps, and session hooks
- [ ] **JRNL-03**: Reader function queries `workflow.jsonl` by time range, phase, plan, event type, and session_id
- [ ] **JRNL-04**: `/gsd:digest` surfaces event timelines per plan
- [ ] **JRNL-05**: Journal rotation at configurable entry count (default 10000)

### Context Budget

- [ ] **BUDG-01**: Token cost measurement function estimates per-skill token consumption from SKILL.md + references (chars/4)
- [ ] **BUDG-02**: Session-level `skill_token_cost` recorded in sessions.jsonl alongside `skills_loaded`
- [ ] **BUDG-03**: Aggregation function computes per-skill average cost, load frequency, and cost-per-fire ratio
- [ ] **BUDG-04**: `/gsd:digest` surfaces context budget analysis with top consumers and cost-per-relevance ratio

### MCP Server Selection

- [ ] **MCPS-01**: Task-type classifier function uses keyword + file extension heuristics to classify tasks
- [ ] **MCPS-02**: MCP recommendation mapping (task type → MCP servers) similar to CATEGORY_SKILL_MAP
- [x] **MCPS-03**: Execute-plan workflow emits MCP server recommendation before executor spawns
- [x] **MCPS-04**: If v10.0 MCP dashboard is running, query available MCP servers via tool call to validate recommendations

## Future Requirements

### Automatic MCP Configuration

- **MCPA-01**: Auto-configure MCP servers for executor based on task classification
- **MCPA-02**: Per-project MCP server profiles

### Advanced Journaling

- **JRNL-06**: Real-time journal streaming via dashboard WebSocket
- **JRNL-07**: Journal replay for debugging

## Out of Scope

| Feature | Reason |
|---------|--------|
| True tokenizer integration | chars/4 sufficient for relative comparison; tokenizer adds binary dep |
| Async/buffered event writes | Synchronous append simpler and fast enough; crash safety outweighs latency |
| Automatic MCP server activation | Advisory first — automatic adds misconfiguration risk |
| Replacing existing JSONL files | Journal supplements, not replaces — backward compat required |
| Cross-project event correlation | Single-project journal sufficient for v13.0 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| JRNL-01 | Phase 57 | Pending |
| JRNL-02 | Phase 57 | Pending |
| JRNL-03 | Phase 57 | Pending |
| JRNL-04 | Phase 57 | Pending |
| JRNL-05 | Phase 57 | Pending |
| BUDG-01 | Phase 58 | Pending |
| BUDG-02 | Phase 58 | Pending |
| BUDG-03 | Phase 58 | Pending |
| BUDG-04 | Phase 58 | Pending |
| MCPS-01 | Phase 59 | Pending |
| MCPS-02 | Phase 59 | Pending |
| MCPS-03 | Phase 59 | Complete |
| MCPS-04 | Phase 59 | Complete |

**Coverage:**
- v13.0 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 after roadmap creation*
