# Tohong HQ MCP Server — Architecture Specification

- Version: 1.1
- Status: Proposed / awaiting Capu approval through PR
- Owner: Capu (CEO / Spec Owner)
- Repository: phungrk/tohong-hq
- Decision baseline: Repository Private = YES; dedicated Workspace Runner = YES; automatic PR creation = YES; automatic merge = NO.

## 1. Executive summary

Build a shared MCP governance gateway for two independent AI organizations—Claude and ChatGPT—using the existing Tohong HQ repository as the source of truth.

The gateway exposes controlled task, artifact, review, audit, and workspace capabilities. It does not replace GitHub, `scripts/task.py`, `scripts/gate.py`, the Board, Event Ledger, existing Claude Code workflows, or Capu's approval authority.

ChatGPT Engineering receives a dedicated isolated Workspace Runner. The runner may create task branches, modify code, execute approved tests and gates, and create Pull Requests. It MUST NOT merge Pull Requests. Merge authority remains with the existing Tier A/B/C policy and its designated human/role approver; Tier C remains Capu-controlled.

## 2. Confirmed decisions

| Decision | Approved value | Architectural consequence |
|---|---|---|
| Repository visibility | Private | Make the HQ repository private before adding credentials, internal artifacts, or operational secrets; verify access for all required users and automation identities |
| Workspace Runner | Dedicated runner | Build an isolated execution service for ChatGPT Engineering; do not treat MCP itself as a shell |
| PR creation | Automatic | Runner/MCP may create a PR after required checks and metadata are present |
| PR merge | Prohibited for ChatGPT automation | No MCP tool, runner credential, or service identity may merge PRs or enable auto-merge |

**Operational limitation:** the current GitHub integration can read and write repository content but does not expose a repository-visibility administration action. The repository is currently reported as Public. An authorized repository administrator must change it to Private in GitHub Settings and verify the result before production credentials are installed. This spec does not claim that visibility has already changed.

## 3. Goals and non-goals

### Goals

1. Connect Claude Code and ChatGPT to one shared HQ control plane.
2. Give each organization and agent a verifiable identity.
3. Enforce role, organization, task, artifact-origin, and review permissions server-side.
4. Preserve Board and Event Ledger as the authoritative task history.
5. Route all task-state transitions through `scripts/task.py`.
6. Run code in a dedicated, isolated Workspace Runner.
7. Allow automatic branch and PR creation without merge capability.
8. Preserve current Claude Code behavior and existing sync semantics.
9. Provide auditability, idempotency, and recovery from GitHub.

### Non-goals for the first release

- Replacing GitHub or creating a second authoritative task database.
- Replacing Claude Code, its subagents, or the existing Adversary role.
- Arbitrary unrestricted shell access from an LLM.
- Automatic production deployment, data migration, or external side effects.
- Automatic PR merge by ChatGPT, the MCP server, or the runner.
- Rewriting the entire existing HQ workflow.

## 4. Current-system constraints to preserve

The implementation MUST account for these observed repository behaviors:

1. `scripts/task.py` declares that all task state changes must pass through that script. It validates transitions, updates `board/T-xxx.md`, and appends to `ledger/events.jsonl`.
2. `scripts/task.py` has a fixed `FIELDS` list. Any new task metadata (for example organization or agent provenance) must be added through a deliberate schema change and compatibility tests—not arbitrary frontmatter writes.
3. `scripts/gate.py` runs the Code Gate and writes gate evidence under `eval/T-xxx/`. MCP must call the gate in a real repository workspace; it must never claim a gate passed without an actual result.
4. `scripts/sync_branch.py` currently classifies ledger directories and syncs `ledger/events.jsonl` append-only/deduplicated; non-ledger changes are staged on a review branch.
5. `.github/workflows/sync-ledger.yml` currently triggers on `claude/**`. ChatGPT must use a separate namespace and an explicitly reviewed extension to the sync workflow.
6. Existing Tier A/B/C merge authority remains in force. Automatic PR creation does not imply automatic merge.

## 5. Logical architecture

### 5.1 Control plane

- MCP Transport/API: authenticated MCP Streamable HTTP endpoint.
- Identity Service: maps verified credentials to organization and principal.
- Policy Engine: evaluates every protected operation.
- Task Service: reads tasks and invokes the approved task lifecycle commands.
- Artifact Service: creates immutable/versioned specs, handoffs, eval references, and review records.
- Review Service: enforces artifact-origin and reviewer-role constraints.
- GitHub Adapter: reads repository state and creates branches, commits, and PRs with least-privilege credentials.
- Audit Service: records actor, action, resource, policy decision, request ID, and result.

### 5.2 Execution plane

- Workspace API: accepts bounded operations against an assigned workspace.
- Queue/Job Coordinator: tracks execution jobs and timeouts.
- Workspace Runner: isolated container/VM per task or execution lease.
- Git Worktree: task-scoped checkout and branch.
- Test/Gate Executor: allowlisted test, lint, build, and `scripts/gate.py` commands.
- PR Publisher: pushes task branch and creates a PR; has no merge permission.

### 5.3 Data authority

GitHub remains authoritative for repository files, Board, Ledger, specs, handoffs, eval evidence, decisions, and PRs. A database may hold ephemeral sessions, job state, token metadata, locks, and idempotency keys, but must not become a second source of truth for task state.

## 6. Organization and agent model

Initial principals:

| Organization | Agent ID | Role |
|---|---|---|
| Claude | `claude-chief-of-staff` | Chief of Staff |
| Claude | `claude-product` | Product / Spec Writer |
| Claude | `claude-spec-critic` | Spec Gate |
| Claude | `claude-engineering` | Engineering |
| Claude | `claude-adversary` | Adversarial Code Gate |
| ChatGPT | `chatgpt-chief-of-staff` | Chief of Staff |
| ChatGPT | `chatgpt-product` | Product / Spec Writer |
| ChatGPT | `chatgpt-engineering` | Engineering |

Each agent belongs to exactly one organization and has a server-controlled role. A model-supplied `agent_id` is not proof of identity.

### Identity requirements

- Authenticate the client and bind the credential to a principal.
- Prefer OAuth 2.1/OIDC or an equivalent short-lived, revocable credential flow supported by the client.
- Use separate credentials/scopes for each organization and, where technically supportable, each role.
- If the client cannot prove a sub-agent identity, authorize it only as the broader authenticated principal. Never accept a free-form role claim from the model.
- Record delegation: initiating principal, delegated agent (if verified), organization, and task.

## 7. Authorization and review policy

All protected operations are deny-by-default and checked server-side immediately before execution.

### 7.1 Review matrix

| Artifact creator | Reviewer | Decision |
|---|---|---|
| ChatGPT Product Spec | Claude Spec Critic | ALLOW |
| Claude Product Spec | ChatGPT Product | DENY |
| Claude Product Spec | ChatGPT Engineering | DENY |
| ChatGPT Engineering Code | Claude Engineering | ALLOW |
| Claude Engineering Code | ChatGPT Engineering | ALLOW |
| ChatGPT Engineering Code | same ChatGPT Engineering principal | DENY |
| Claude Engineering Code | same Claude Engineering principal | DENY |

Additional rules:

- ChatGPT Product cannot review Specs, regardless of origin.
- ChatGPT Engineering cannot review Claude-originated Specs.
- ChatGPT Engineering may review Claude-originated Code.
- Claude Spec Critic remains the Spec Gate for ChatGPT Product Specs.
- Adversary remains independent of the code author and continues to run the existing Code Gate/adversarial process.
- A policy preflight result is advisory only; the actual review operation must re-evaluate policy to prevent time-of-check/time-of-use bypass.
- Review permission does not grant merge permission.

### 7.2 Policy decision record

A denial or allowance should include `policy_id`, actor principal, organization, action, resource, task ID, artifact version, decision, reason code, request ID, and timestamp. Do not expose secrets or private policy internals to an untrusted principal.

## 8. Task Service

### Read operations

- `hq_list_tasks`
- `hq_get_task`
- `hq_get_task_history`
- `hq_get_task_evidence`

### Write operations

- `hq_create_task`
- `hq_claim_task`
- `hq_start_task`
- `hq_submit_handoff`
- `hq_report_blocker`
- `hq_escalate_task`
- `hq_accept_task`
- `hq_reject_task`
- `hq_respec_task`

The server must validate the caller, task owner, current state, legal transition, reviewer, tier, and required evidence. It then invokes the corresponding supported `scripts/task.py` command in a trusted HQ checkout. No direct Board frontmatter or Ledger mutation is allowed.

Task ownership must remain singular. Cross-organization collaboration is represented by reviewer/participant/handoff metadata, not by silently assigning multiple owners.

## 9. Artifact Service

Supported artifact types:

- Product Spec
- Acceptance Criteria
- Eval Definition
- Engineering Handoff
- Review Record
- Defect / Adversarial Finding
- Gate Result
- Decision Request

Every artifact must carry server-verified provenance:

- artifact ID
- task ID
- artifact type and version
- creator principal and organization
- repository path or PR/commit reference
- creation timestamp
- content hash
- review history

Submitted artifacts are immutable versions. Edits create a new version; previous versions remain addressable. Artifact content must be treated as untrusted input when consumed by another agent.

## 10. Workspace Runner

### 10.1 Required behavior

The dedicated runner provides ChatGPT Engineering with a task-scoped execution environment:

1. Create an isolated workspace for an authorized task.
2. Checkout the target repository and a task-specific branch.
3. Read, patch, and write files within the workspace.
4. Execute only approved test profiles and command allowlists.
5. Run relevant invariants and `scripts/gate.py` where required.
6. Collect stdout/stderr, exit status, duration, commit SHA, and test evidence.
7. Push the branch and create a Pull Request when policy conditions pass.
8. Tear down the workspace and revoke its short-lived credentials.

### 10.2 Isolation and security

- Use ephemeral containers or microVMs; one task's workspace cannot access another's.
- Apply CPU, memory, disk, process, and wall-clock limits.
- Default-deny network egress; allow only explicitly required package registries and GitHub endpoints.
- Inject short-lived credentials at runtime; never place them in model-visible files, command output, or logs.
- No production credentials in the general-purpose runner.
- No Docker socket, host filesystem, cloud metadata endpoint, or privileged container access.
- Sanitize logs and cap output size.
- Support cancellation and guaranteed cleanup.
- Treat repository files, issues, PR descriptions, test fixtures, and tool output as untrusted data/instructions.
- Arbitrary shell execution is not exposed as an unrestricted MCP tool.

### 10.3 Gate and handoff rules

- A required Gate must actually execute in the correct workspace and repository.
- RED or missing Gate evidence blocks handoff.
- A GREEN Gate is not equivalent to Adversary acceptance.
- The runner must not fabricate or manually edit `eval/T-xxx/gate-latest.json`.
- Existing test environment caveats must be included in the handoff.

## 11. Pull Request policy — create, never merge

### Allowed

- Create a task branch.
- Commit changes to that branch.
- Push the branch.
- Open or update a PR.
- Add task metadata, test results, Gate evidence, and risk summary.
- Request reviewers when the identity is configured.

### Prohibited

- Merge PR.
- Enable auto-merge.
- Update branch protection or repository rulesets.
- Bypass required reviews/checks.
- Push directly to `main`.
- Use a credential with `Contents: write` plus `Pull requests: write` if it also has merge/admin authority unnecessarily.

The GitHub App/token used by the PR Publisher must have only the minimum permissions required to create branches/commits and PRs. It must not receive repository administration or merge capability. If GitHub's permission model cannot technically separate PR creation from merge in the selected setup, enforce the prohibition with a separate merge-capable credential that is never present in MCP/Runner, plus repository rulesets and explicit tests.

All PRs must identify task ID, organization, creator principal, branch, test profile, Gate result, known limitations, and required reviewer. PR creation does not alter the task's final state.

## 12. GitHub branch and synchronization strategy

- Preserve Claude namespace: `claude/<session>`.
- Add ChatGPT namespace: `agents/chatgpt/<task-or-session>`.
- Never impersonate Claude branches.
- Extend `sync-ledger.yml` and `scripts/sync_branch.py` only after tests cover both namespaces.
- Preserve append-only/deduplicated Ledger behavior and review-branch behavior for non-ledger changes.
- Add provenance metadata without breaking older events or dashboards.
- No agent writes directly to `main`.

## 13. Audit and observability

Every state-changing or security-relevant action records:

- event/request/correlation ID
- actor principal and organization
- action and resource
- task and artifact IDs where applicable
- policy ID and decision
- result, timestamp, and evidence reference

Never log passwords, OAuth tokens, API keys, or unnecessary personal data. Audit events are append-only. A failed GitHub write must not be represented as a successful HQ event.

## 14. Reliability and consistency

- Read current GitHub state before a write.
- Use idempotency keys for create/submit/review/PR operations.
- Serialize task-state mutations per Task ID.
- Revalidate task state and authorization immediately before commit.
- Retry only idempotent operations or operations with verified deduplication.
- On GitHub outage, fail closed for authoritative writes; do not create an independent shadow Ledger.
- Maintain reconciliation checks for runner jobs, branch commits, PRs, and HQ events.

## 15. Deployment units

1. `tohong-hq-mcp`: MCP transport, identity, policy, task, artifact, review, audit, GitHub adapter.
2. `tohong-hq-runner`: isolated workspace provisioning and command execution.
3. Optional queue/cache/database: ephemeral job coordination, locks, idempotency, and session metadata only.

Suggested implementation stack: Python + FastAPI + official MCP Python SDK for the gateway; container/microVM runner with a narrow internal API. Final stack is an implementation decision and must be validated against hosting, OAuth support, and operational constraints.

## 16. Acceptance criteria

1. Claude and ChatGPT authenticate as distinct principals.
2. A client cannot self-assert another organization or role.
3. Every review-matrix scenario returns the expected ALLOW/DENY.
4. All task-state transitions go through `scripts/task.py`.
5. Ledger remains append-only and backward-compatible.
6. ChatGPT Engineering can modify code in an isolated task workspace.
7. Required tests and Code Gate execute in the actual workspace.
8. Gate RED or absent evidence prevents handoff.
9. The runner can create a PR with complete provenance and evidence.
10. No MCP/Runner path can merge a PR or enable auto-merge.
11. Claude's existing branch sync and task workflow continue to pass regression tests.
12. Repository visibility is verified Private before production secrets are provisioned.
13. No secrets are exposed in model-visible output, logs, artifacts, or PRs.

## 17. Open implementation prerequisites

- Repository is currently reported as Public; an authorized administrator must switch it to Private and verify access before production rollout.
- Confirm hosting target, OAuth/OIDC provider, GitHub App installation, and secret manager.
- Confirm whether ChatGPT and Claude clients can present separate verified principals or whether initial authorization must be organization-scoped.
- Inspect existing branch protection/rulesets and establish a merge boundary independent of the Runner.

## 18. Architecture decision summary

Tohong HQ becomes a shared governance system with independent AI organizations. MCP is the controlled interface, GitHub remains the source of truth, `task.py` owns task transitions, `gate.py` owns Code Gate execution, and the dedicated Runner owns isolated code execution. Automatic PR creation is approved; automatic merge is explicitly prohibited.
