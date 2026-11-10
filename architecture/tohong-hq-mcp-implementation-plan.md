# Tohong HQ MCP — Implementation Plan

- Version: 1.0
- Status: Proposed execution plan
- Parent: `architecture/tohong-hq-mcp-architecture.md`
- Confirmed decisions: Private repository; dedicated Workspace Runner; automatic PR creation; no automatic merge.

## 1. Delivery strategy

Implement in gated increments. Do not begin production credential provisioning until repository visibility is Private and verified. Do not enable ChatGPT code execution until identity, policy, isolation, and audit foundations pass.

Each milestone ends with a demonstrable acceptance test and a Capu review point. No milestone grants merge authority to the MCP server or Workspace Runner.

## 2. Work breakdown

### M0 — Security and repository readiness

**Purpose:** establish a safe baseline before adding services or credentials.

Tasks:
- M0.1 Change `phungrk/tohong-hq` visibility from Public to Private through GitHub repository Settings.
- M0.2 Verify Capu, Claude Code automation, GitHub Actions, and required service identities retain least-privilege access.
- M0.3 Inspect existing branch protection and rulesets; document who can merge and required checks.
- M0.4 Create a GitHub App or equivalent narrowly scoped identity for MCP/Runner.
- M0.5 Establish a secret manager and separate development/staging/production credentials.
- M0.6 Record repository visibility and access verification as deployment evidence.

Acceptance:
- Repository API/UI reports `private`.
- Required human and automation access is verified.
- No production credential is installed while the repository remains Public.
- Runner/MCP identity has no repository administration or merge permission.

Gate: Capu approval required before M1.

### M1 — Contract, identity, and policy foundation

**Purpose:** define and test trust boundaries before enabling writes.

Tasks:
- M1.1 Define MCP tool schemas and versioning conventions.
- M1.2 Implement authenticated MCP transport and request context.
- M1.3 Implement principal registry for Claude and ChatGPT organizations.
- M1.4 Implement deny-by-default Policy Engine.
- M1.5 Implement artifact provenance schema and policy decision records.
- M1.6 Add unit tests for forged agent IDs, forged roles, expired/revoked credentials, and cross-organization access.
- M1.7 Add review-matrix tests for all required ALLOW/DENY scenarios.

Acceptance:
- Claude and ChatGPT resolve to distinct verified principals.
- A model cannot elevate its role by passing a different `agent_id`.
- All review policy tests pass.
- No write tools are exposed to unverified identities.

Gate: Capu approves identity and permission matrix.

### M2 — Read-only HQ integration

**Purpose:** connect both organizations to the real HQ without risking state changes.

Tasks:
- M2.1 Implement GitHub read adapter.
- M2.2 Implement `hq_list_tasks`, `hq_get_task`, `hq_get_task_history`, and evidence reads.
- M2.3 Normalize legacy Ledger events without rewriting them.
- M2.4 Add audit records for read access where required.
- M2.5 Test rate limits, pagination, stale reads, and GitHub outage behavior.
- M2.6 Connect a ChatGPT test client and a Claude test client.

Acceptance:
- Both organizations read the same Board/Specs/Ledger from GitHub.
- No shadow task database is created.
- Read-only mode cannot mutate repository content.
- GitHub outage is reported clearly; no stale state is represented as current.

Gate: Capu validates shared visibility and data interpretation.

### M3 — Task lifecycle and artifact writes

**Purpose:** enable governed work creation and handoff.

Tasks:
- M3.1 Build a trusted HQ command adapter that invokes `scripts/task.py`.
- M3.2 Define schema evolution for organization/agent provenance in task metadata.
- M3.3 Add compatibility tests for old Board files and old Ledger events.
- M3.4 Implement per-task mutation locks and idempotency keys.
- M3.5 Implement artifact create/version/submit operations.
- M3.6 Implement handoff, blocker, accept/reject, and escalation wrappers.
- M3.7 Prohibit direct Board frontmatter and Ledger mutation through MCP.
- M3.8 Add reconciliation tests between script output, Board state, and Ledger event.

Acceptance:
- Every state transition is executed through `task.py`.
- Duplicate requests do not create duplicate transitions/events.
- Old tasks and events remain readable.
- Artifact versions preserve creator and organization provenance.

Gate: Capu approves the first end-to-end Product task.

### M4 — Cross-organization review and GitHub PR integration

**Purpose:** allow controlled collaboration across the two AI organizations.

Tasks:
- M4.1 Implement review service with server-side policy revalidation.
- M4.2 Implement review records bound to immutable artifact versions.
- M4.3 Add ChatGPT branch namespace `agents/chatgpt/<task-or-session>`.
- M4.4 Extend `sync-ledger.yml` and `sync_branch.py` to support ChatGPT branches without changing Claude behavior.
- M4.5 Add regression tests for append-only/deduplicated Ledger sync.
- M4.6 Implement branch and PR creation using a no-merge GitHub identity.
- M4.7 Add PR templates/metadata for task, organization, creator, checks, Gate, risks, and reviewer.
- M4.8 Add negative tests proving MCP cannot merge, enable auto-merge, or push to main.

Acceptance:
- Review matrix is enforced at the write endpoint, not merely shown to the model.
- ChatGPT Product Spec can be handed to Claude Spec Critic.
- ChatGPT Product cannot review any Spec.
- ChatGPT Engineering can review Claude Code but cannot review Claude Spec.
- Claude review permissions follow the agreed matrix.
- PR creation works; merge and auto-merge attempts are denied.
- Existing Claude sync tests pass unchanged.

Gate: Capu approves cross-organization review and PR behavior.

### M5 — Dedicated Workspace Runner

**Purpose:** enable ChatGPT Engineering to execute real code tasks safely.

Tasks:
- M5.1 Select hosting platform and isolation primitive (ephemeral container or microVM).
- M5.2 Implement task-scoped workspace provisioning and cleanup.
- M5.3 Implement short-lived GitHub credential injection.
- M5.4 Implement bounded file read/write/patch operations.
- M5.5 Implement command profiles and allowlists for test, lint, build, and gate.
- M5.6 Implement CPU/RAM/disk/time/process/network limits.
- M5.7 Implement job cancellation, timeout, output truncation, and secret redaction.
- M5.8 Implement execution evidence collection.
- M5.9 Implement branch push and automatic PR creation.
- M5.10 Enforce no merge permission at credential, API, and policy layers.
- M5.11 Run hostile workspace tests and cross-task isolation tests.

Acceptance:
- Task A cannot read or alter Task B's workspace.
- Runner cannot access host secrets or production systems.
- Disallowed commands and network egress are blocked.
- Test/Gate results are actual process results tied to commit SHA.
- RED/missing Gate blocks handoff.
- PR is created only after policy-required checks.
- No execution path can merge a PR or enable auto-merge.

Gate: Security review and Capu approval before enabling ChatGPT Engineering on production tasks.

### M6 — Production hardening and rollout

Tasks:
- M6.1 Add structured logs, metrics, traces, request/correlation IDs.
- M6.2 Add rate limits and per-organization quotas.
- M6.3 Add backup/recovery and reconciliation procedures.
- M6.4 Add credential rotation and revocation runbooks.
- M6.5 Add load, fault-injection, and end-to-end tests.
- M6.6 Conduct security review of MCP, Runner, GitHub App, and CI workflows.
- M6.7 Run a limited pilot with one low-risk ChatGPT Engineering task.
- M6.8 Expand gradually after pilot evidence is accepted.

Acceptance:
- All critical security and lifecycle tests pass.
- No regression in Claude Code workflows.
- Monitoring can identify failed jobs, policy denials, sync errors, and orphaned workspaces.
- Rollback and credential revocation have been tested.
- Capu approves production rollout.

## 3. Dependency graph

```text
M0 Repository & Security Readiness
                 |
                 v
M1 Identity + Policy Foundation
                 |
                 v
M2 Read-only HQ Integration
                 |
                 v
M3 Task Lifecycle + Artifact Writes
                 |
                 v
M4 Cross-review + PR Integration
                 |
                 v
M5 Dedicated Workspace Runner
                 |
                 v
M6 Production Hardening + Pilot
```

M5 infrastructure design can be explored in parallel with M2–M4, but ChatGPT code execution must remain disabled until M1, M3, M4 security controls and runner isolation are accepted.

## 4. Priority and sequencing

| Priority | Milestone | Why |
|---|---|---|
| P0 | M0 | Repository currently reports Public; resolve before credentials |
| P0 | M1 | Establish identity and deny-by-default permissions |
| P1 | M2 | Safely expose shared HQ context |
| P1 | M3 | Enable governed task and artifact lifecycle |
| P1 | M4 | Enforce cross-organization collaboration and no-merge PRs |
| P2 | M5 | Enable code execution only after governance foundation |
| P2 | M6 | Production readiness and controlled rollout |

## 5. Initial backlog proposal

Create implementation tasks only after Architecture Spec approval. Suggested task grouping:

| Workstream | Proposed tasks |
|---|---|
| Security | M0 repository privacy, access audit, GitHub App, secrets |
| Platform | MCP service skeleton, transport, configuration, health checks |
| Identity | principal registry, authentication, delegation |
| Governance | policy engine, review matrix, authorization tests |
| HQ Core | task.py adapter, task schema migration, artifact service |
| GitHub | branch namespace, sync workflow, PR publisher |
| Runner | workspace lifecycle, sandbox, command profiles, evidence |
| Quality | integration tests, adversarial tests, regression suite |
| Operations | deployment, observability, recovery, runbooks |

The Chief of Staff should split these into concrete HQ tasks with explicit owner, reviewer, tier, area, acceptance criteria, and executable evals. Engineering tasks must not be assigned until their required evals are registered under the existing HQ rules.

## 6. Rollback strategy

- M0/M1: disable MCP endpoint and revoke credentials; existing Claude workflow remains untouched.
- M2: disable read integration; GitHub repository remains authoritative.
- M3: disable write tools; do not reverse or rewrite Ledger events.
- M4: disable ChatGPT branch trigger and PR publisher; retain already-created branches/PRs for human disposition.
- M5: stop queue intake, cancel jobs, destroy ephemeral workspaces, revoke runner credentials; do not merge or delete user branches automatically.
- M6: return to pilot-only mode and rotate credentials if compromise is suspected.

Rollback must never rewrite historical Ledger events or silently revert accepted product changes.

## 7. Definition of delivery complete

The project is complete when all M0–M6 acceptance criteria pass, both AI organizations use distinct verified identities, ChatGPT Engineering can complete a bounded code task in the dedicated runner, the system creates a reviewable PR, and no MCP/Runner credential or API can merge it. Existing Claude workflows must pass regression tests throughout.
