# GATE-04: Quality Gating Tool Evaluation

**Phase:** 29
**Requirement:** GATE-04
**Status:** Complete
**Date:** 2026-03-10

## Summary

Five MCP server candidates across three categories (linting/code quality, static analysis/security, repository intelligence, dependency auditing, and multi-language static analysis) were evaluated for integration into the GSD quality sentinel. ESLint MCP (@eslint/mcp) is recommended for implementation in a future milestone as an optional enhancement to the diff_review gate -- it has the highest value-to-effort ratio, is production-ready, and fits cleanly into the existing Node.js/Rust project without new runtime dependencies. Semgrep MCP (semgrep-mcp) is the strongest candidate for a new security_scan gate but should be deferred to v7.1+ pending GA release and resolution of the Python runtime dependency concern.

## Candidates Evaluated

| Candidate | Category | Maturity | Integration Feasibility | Gate Coverage Improvement | Context Budget Impact | Recommendation |
|-----------|----------|----------|------------------------|--------------------------|----------------------|----------------|
| ESLint MCP (@eslint/mcp) | Linting / Code Quality | Production | HIGH | MEDIUM | LOW | IMPLEMENT |
| Semgrep MCP (semgrep-mcp) | Static Analysis / Security | Beta | MEDIUM | HIGH | MEDIUM | CONSIDER (v7.1+) |
| GitHub MCP Server (github/github-mcp-server) | Repository Intelligence | Production | LOW | LOW | HIGH | DO NOT IMPLEMENT |
| NPM Security Audit MCP (mcp-security-audit) | Dependency Auditing | Community | MEDIUM | LOW | LOW | DO NOT IMPLEMENT |
| Code Analysis MCP Server (cbunting99/mcp-code-analysis-server) | Multi-language Static Analysis | Community | LOW | MEDIUM | UNKNOWN | DO NOT IMPLEMENT |

## Candidate Details

### Candidate 1: ESLint MCP Server (@eslint/mcp)

**Category:** Linting / Code Quality
**Maturity:** Production-ready (official ESLint team, released v9.26.0+)

| Property | Value |
|----------|-------|
| Package | `@eslint/mcp` (npm) |
| Installation | `npx @eslint/mcp@latest` |
| Transport | stdio |
| Tools provided | `lint_files` (lint by file path), `lint_and_fix` (lint + auto-fix) |
| Languages | JavaScript, TypeScript (via project ESLint config) |

**Integration Feasibility: HIGH**

Trivial `.mcp.json` addition: `{"eslint": {"command": "npx", "args": ["-y", "@eslint/mcp@latest"]}}`. May need jiti dep for TypeScript configs. The project already uses ESLint (`npm run lint`), so the MCP server would leverage existing `.eslintrc` / `eslint.config.*` configuration. Could be invoked during Step 5 (diff_review) to get structured linting results on staged files instead of relying on Claude's self-review of the diff.

**Gate Coverage Improvement: MEDIUM**

Currently diff_review is a "self-report" gate -- the executor reads its own diff and self-reports issues. ESLint MCP would add deterministic, tool-backed lint checking to staged files. Does NOT replace diff_review (which checks for duplication, naming, TODOs, error handling) but strengthens it with real linting output. Would catch style violations, unused variables, unreachable code, and config-enforced patterns that self-review misses.

**Context Budget Impact: LOW**

The MCP call is tool-based (lint specific file paths), returning structured results. Estimated 200-500 tokens per invocation depending on number of findings. No additional context window consumption for library docs -- it runs ESLint directly.

**Recommendation:** IMPLEMENT in a future milestone. Highest value-to-effort ratio. Add as an optional enhancement to the diff_review gate in standard/strict modes.

---

### Candidate 2: Semgrep MCP Server (semgrep-mcp)

**Category:** Static Analysis / Security Scanning
**Maturity:** Beta (official Semgrep team, actively developed)

| Property | Value |
|----------|-------|
| Package | `semgrep-mcp` (PyPI) or Docker `ghcr.io/semgrep/mcp` |
| Installation | `pipx install semgrep-mcp` or `uvx semgrep-mcp` |
| Transport | stdio, streamable-http, SSE |
| Tools provided | `security_check`, `semgrep_scan`, `semgrep_scan_with_custom_rule`, `get_abstract_syntax_tree`, `semgrep_findings`, `supported_languages`, `semgrep_rule_schema` |
| Languages | 30+ (JavaScript, TypeScript, Python, Go, Rust, etc.) |

**Integration Feasibility: MEDIUM**

Requires Python runtime (pipx/uvx) -- the project is Node.js/Rust-based, so this adds a Python dependency. Docker alternative avoids this but adds container overhead. `.mcp.json` config: `{"semgrep": {"command": "uvx", "args": ["semgrep-mcp"]}}` or `{"semgrep": {"command": "semgrep", "args": ["mcp"]}}` if Semgrep CLI is installed. 5,000+ built-in rules cover OWASP Top 10, CWE patterns, and language-specific anti-patterns. Could create a new `security_scan` gate (6th sentinel step) or augment diff_review.

**Gate Coverage Improvement: HIGH**

Addresses a gap the current sentinel does not cover: deterministic security vulnerability scanning. Current gates focus on reuse (codebase_scan), docs (context7_lookup), testing (test_baseline, test_gate), and diff quality (diff_review). None perform security-focused static analysis. Would catch injection vulnerabilities, hardcoded credentials, insecure cryptographic patterns, path traversal risks.

**Context Budget Impact: MEDIUM**

The `security_check` tool returns structured findings with severity, description, and fix suggestions. Typical response is 300-1000 tokens depending on findings count. The scan itself is fast (Semgrep is optimized for speed), but if scanning all changed files per task, wall-clock time could add 2-5 seconds per invocation. Beta status means potential for instability or breaking changes.

**Recommendation:** CONSIDER for a future milestone (v7.1+). High value for security coverage but adds Python dependency and is still in beta. Wait for GA release or evaluate Docker-based deployment.

---

### Candidate 3: GitHub MCP Server (github/github-mcp-server)

**Category:** Repository Intelligence / Code Review
**Maturity:** Production (official GitHub team, public since April 2025)

| Property | Value |
|----------|-------|
| Package | Docker or Go binary |
| Installation | `docker run ghcr.io/github/github-mcp-server` or standalone binary |
| Transport | stdio, remote |
| Tools provided | Repository management, file operations, PR management, code search, commit search, issue handling |
| Scope | GitHub-hosted repositories only |

**Integration Feasibility: LOW**

The GitHub MCP server is designed for repository management operations (PRs, issues, code search), not for code quality analysis. The project already uses `gh` CLI for GitHub operations. Adding this MCP server would duplicate existing capabilities without quality gating benefit. Could theoretically be used to search for patterns across the GitHub ecosystem, but this overlaps with Context7's purpose (library documentation) and does not address code quality.

**Gate Coverage Improvement: LOW**

No new gate coverage. The tools focus on GitHub platform operations, not code analysis.

**Context Budget Impact: HIGH (negative)**

Repository operations return large JSON payloads (PR metadata, file lists, issue threads). Using this in the sentinel would consume significant context for minimal quality benefit.

**Recommendation:** DO NOT IMPLEMENT for quality gating. Not relevant to the sentinel gate model. The `gh` CLI already covers GitHub operations needed by the workflow.

---

### Candidate 4: NPM Security Audit MCP (mcp-security-audit)

**Category:** Dependency Auditing / Supply Chain Security
**Maturity:** Community (not official npm team)

| Property | Value |
|----------|-------|
| Package | `mcp-security-audit` (npm, community) |
| Installation | `npx mcp-security-audit` |
| Transport | stdio |
| Tools provided | Dependency vulnerability scanning against npm registry |
| Scope | npm packages only |

**Integration Feasibility: MEDIUM**

Node.js-native, easy `.mcp.json` addition. However, `npm audit` already exists as a CLI tool and could be invoked via Bash in the executor without an MCP server. Adds real-time registry checking, but the same result is achievable with `npm audit --json` in a shell command.

**Gate Coverage Improvement: LOW**

Dependency auditing is a project-level concern, not a per-task concern. Running it on every task execution would be wasteful -- dependencies rarely change between tasks. Better suited as a phase-level or milestone-level check rather than a sentinel step.

**Context Budget Impact: LOW**

Low per invocation (structured JSON results), but pointlessly frequent if run per-task.

**Recommendation:** DO NOT IMPLEMENT as a sentinel gate. If dependency auditing is desired, use `npm audit --json` in the phase verification step (verifier workflow), not the per-task sentinel. No MCP server needed.

---

### Candidate 5: Code Analysis MCP Server (cbunting99/mcp-code-analysis-server)

**Category:** Multi-language Static Analysis
**Maturity:** Community (individual developer, limited adoption)

| Property | Value |
|----------|-------|
| Package | GitHub repository (not published to npm) |
| Installation | Clone + build |
| Tools provided | Code complexity analysis, dependency analysis, static analysis |
| Languages | Multiple (unspecified) |

**Integration Feasibility: LOW**

Not published to npm or PyPI. Requires manual clone and build. No evidence of production usage or active maintenance beyond initial release. Feature overlap with ESLint (lint) + Semgrep (security) makes this redundant if either of those is adopted.

**Gate Coverage Improvement: MEDIUM in theory, LOW in practice**

Complexity analysis is not covered by current gates, but value is LOW in practice due to maturity concerns.

**Context Budget Impact: UNKNOWN**

No documentation on response sizes or performance characteristics.

**Recommendation:** DO NOT IMPLEMENT. Immature, not published, redundant with better-maintained alternatives.

## Implementation Recommendations

### Recommended for Future Milestone

**ESLint MCP (@eslint/mcp) — IMPLEMENT**

- Target gate: `lint_check` (post-task, before diff_review)
- Trigger condition: standard mode — `.js`/`.ts`/`.cjs` files changed; strict mode — always
- Integration pattern: Add to `.mcp.json` alongside `context7`; invoke `lint_files` tool on staged file paths
- Proposed gate name: `lint_check`
- Position in sentinel: Step 5 (between test_gate and diff_review)
- Minimal `.mcp.json` addition:
  ```json
  "eslint": {
    "command": "npx",
    "args": ["-y", "@eslint/mcp@latest"]
  }
  ```

**Semgrep MCP (semgrep-mcp) — CONSIDER (v7.1+)**

- Target gate: `security_scan` (post-task, after lint_check)
- Trigger condition: standard mode — new files only; strict mode — all changed files
- Integration pattern: Add to `.mcp.json` using `uvx semgrep-mcp`; invoke `security_check` on changed files
- Proposed gate name: `security_scan`
- Deferred reason: Beta status, Python runtime dependency, potential breaking changes

### Not Recommended

**GitHub MCP Server — DO NOT IMPLEMENT**
The server is designed for repository management, not code quality. The `gh` CLI already covers all GitHub workflow needs. Adding it would bloat context budget with large JSON payloads for zero gate coverage improvement.

**NPM Security Audit MCP — DO NOT IMPLEMENT**
The same functionality is available via `npm audit --json` in a Bash step, which requires no new MCP server. Dependency auditing is a project-level concern, not appropriate for per-task sentinel execution.

**Code Analysis MCP Server (cbunting99) — DO NOT IMPLEMENT**
Not published to a package registry, requires manual clone and build, and is redundant with ESLint and Semgrep. Community maturity is insufficient for inclusion in the sentinel gate model.

## Integration Architecture (if implemented)

### .mcp.json Addition Pattern

```json
// .mcp.json — add alongside existing context7 entry
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "eslint": {
      "command": "npx",
      "args": ["-y", "@eslint/mcp@latest"]
    }
  }
}
```

### Gate Integration Pattern

New MCP-backed gates follow the existing sentinel step pattern:

1. **Pre-task or post-task:** Determine when the gate fires (pre-task for security scanning, post-task for lint checking)
2. **Outcome recording:** Same `GATE_OUTCOMES` array mechanism: `"{task_num}|{gate_name}|{outcome}|{detail}"`
3. **Gate behavior matrix:** Same fast/standard/strict conditional behavior
4. **JSONL persistence:** Same `write-gate-execution.cjs` library — `VALID_GATES` set must be extended with new gate names
5. **Context budget:** Each MCP tool call consumes context tokens for the response; gate should cap or truncate findings to limit budget impact

### VALID_GATES Update

The `write-gate-execution.cjs` library would need its `VALID_GATES` set extended:

```javascript
// Current (5 gates)
const VALID_GATES = new Set([
  'codebase_scan', 'context7_lookup', 'test_baseline', 'test_gate', 'diff_review',
]);

// Future (7 gates, if both candidates are adopted)
const VALID_GATES = new Set([
  'codebase_scan', 'context7_lookup', 'test_baseline',
  'test_gate', 'lint_check', 'security_scan', 'diff_review',
]);
```

### Proposed Gate Additions (Future)

| Gate Name | MCP Server | Position | Trigger Condition |
|-----------|------------|----------|-------------------|
| `lint_check` | @eslint/mcp | Post-task (before diff_review) | standard: .js/.ts/.cjs files changed; strict: always |
| `security_scan` | semgrep-mcp | Post-task (after lint_check) | standard: new files only; strict: all changed files |

## Common Pitfalls

### Pitfall 1: MCP Server Startup Latency
**What goes wrong:** MCP servers using `npx` have cold-start latency (2-10 seconds for npm package download + process start). Running this per-task in the sentinel appears to add wall-clock time.
**How to avoid:** Claude Code keeps MCP servers alive between tool calls within a session. The cold-start cost is per-session, not per-task. Document this expectation.

### Pitfall 2: Context Budget Bloat from Verbose Findings
**What goes wrong:** Security scanners and linters can return hundreds of findings for a large changeset, consuming thousands of context tokens.
**How to avoid:** Cap findings in the gate implementation (e.g., "show first 5 findings, summarize remaining N"). Truncate tool responses if they exceed a threshold.

### Pitfall 3: Python Runtime Dependency for Semgrep
**What goes wrong:** The project is Node.js/Rust. Adding a Python MCP server introduces a new runtime dependency that may not be present on all developer machines.
**How to avoid:** If Semgrep is adopted, use the Docker transport or wait for a potential Node.js wrapper. Alternatively, make it an opt-in gate that only activates if `semgrep` is on PATH.

### Pitfall 4: False Positive Fatigue
**What goes wrong:** Adding automated linting and security gates produces findings that may not be relevant (false positives), causing developers to ignore or disable gates.
**How to avoid:** Start with `warned` outcomes only (standard mode). Never auto-block on lint or security findings until the rule set has been tuned. Use `.semgrepignore` and ESLint `eslint-disable` patterns to suppress known false positives.

### Pitfall 5: Gate Ordering Dependencies
**What goes wrong:** Adding new gates between existing ones can change the sentinel step numbering, breaking documentation and SUMMARY.md references.
**How to avoid:** Use gate names (not step numbers) as the canonical identifier. The current `write-gate-execution.cjs` already uses string gate names, not ordinals.

## Open Questions

1. **ESLint MCP tool response format**
   - What we know: It provides `lint_files` and `lint_and_fix` tools via MCP
   - What's unclear: Exact response schema (JSON? structured? prose?) and token size per invocation
   - Recommendation: Test with `npx @eslint/mcp@latest` in a scratch project before planning integration

2. **Semgrep MCP stability timeline**
   - What we know: Currently beta, actively developed by Semgrep team
   - What's unclear: When GA release is expected; whether breaking changes are planned
   - Recommendation: Monitor semgrep/mcp GitHub releases; plan integration for v7.1+ when stable

3. **Context cap mechanism for new MCP gates**
   - What we know: Current `quality.context7_token_cap` is 2000
   - What's unclear: Whether a similar cap mechanism should be added for new MCP tool responses
   - Recommendation: Add a `quality.mcp_response_cap` config option if new MCP gates are implemented
