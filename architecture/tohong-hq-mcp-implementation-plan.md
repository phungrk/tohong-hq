# Tohong HQ — Browser-Only Implementation Plan

- Version: 2.0
- Status: Proposed execution plan
- Parent: `architecture/tohong-hq-mcp-architecture.md` (v2.0)
- Operating decision: ChatGPT Go in browser only; GitHub Connector + GitHub Actions; no Claude Code, Codex desktop, local terminal, AWS Runner, or custom MCP in this phase.
- Governance: PR creation allowed; automatic merge prohibited.

## 1. Delivery strategy

Deliver the smallest secure browser-first workflow. ChatGPT authors and reviews; GitHub stores and controls changes; GitHub Actions executes scripts and checks; a human approves merges and high-impact operations.

Do not build a custom MCP service or execution infrastructure unless a measured limitation of the browser-only model justifies a later architecture decision.

## 2. Milestones

### M0 — Repository and permission readiness (P0)

Tasks:
- M0.1 Verify repository visibility. If still Public, an authorized administrator changes it to Private.
- M0.2 Audit the connected GitHub integration's repository and write permissions.
- M0.3 Protect `main`: require PR, required status checks, and appropriate human review.
- M0.4 Confirm no ChatGPT-connected credential has repository administration or merge authority beyond what is strictly necessary.
- M0.5 Review Actions permissions, secrets, environment protection, and workflow write scopes.

Acceptance:
- Repository visibility is verified Private before production secrets are provisioned.
- Main branch protections are active and tested.
- GitHub access is least-privilege and documented.
- No claim of privacy or protection is made without verification.

### M1 — Browser operating protocol (P0)

Tasks:
- M1.1 Document ChatGPT role prompts and handoff formats for CEO/CoS, Product, Spec Critic, Engineering, and Adversary.
- M1.2 Define a standard task brief: task ID, objective, scope, owner, reviewer, tier, acceptance criteria, risks, and required evidence.
- M1.3 Define a standard PR body and review checklist.
- M1.4 Document connector capability fallback: when a GitHub operation is unavailable, produce a patch and manual steps.
- M1.5 Establish evidence language: distinguish authored, committed, workflow-executed, reviewed, and merged states.

Acceptance:
- Every task starts from an existing HQ task or a human-approved task proposal.
- ChatGPT does not claim an action without a tool result or GitHub evidence.
- One authenticated ChatGPT identity is not represented as several independently authenticated agents.

### M2 — GitHub Actions quality pipeline (P1)

Tasks:
- M2.1 Inventory existing workflows and current CI coverage.
- M2.2 Add/verify PR-triggered lint, type-check, unit-test, and build jobs appropriate to the repository.
- M2.3 Add dependency/security checks where applicable.
- M2.4 Upload test logs and machine-readable result artifacts.
- M2.5 Ensure each run reports commit SHA and a stable status check name.
- M2.6 Configure required checks on protected branches.

Acceptance:
- PRs receive reproducible checks on the exact head commit.
- Failed, cancelled, skipped, or absent required checks cannot be treated as success.
- Workflow permissions are read-only by default and elevated only per job.

### M3 — Governed task lifecycle via Actions (P1)

Tasks:
- M3.1 Keep `scripts/task.py` as the sole task-state transition interface.
- M3.2 Add a manually dispatched workflow with an allowlisted set of task transitions and validated task ID input.
- M3.3 Validate actor authorization, current task state, allowed transition, and required fields before invoking the script.
- M3.4 Run `scripts/task.py` in a clean checkout; do not accept arbitrary shell or path inputs.
- M3.5 Validate Board/Ledger consistency and publish run evidence.
- M3.6 Add idempotency/retry protections and concurrency control per task.
- M3.7 Consider an Issue/label command adapter only after the manual-dispatch workflow is secure and proven.

Acceptance:
- Every state transition is made by `task.py`.
- Unauthorized, invalid, duplicate, or stale transitions fail closed.
- The resulting workflow run is the evidence of the transition.
- ChatGPT cannot directly write task status or Ledger events.

### M4 — ChatGPT-to-GitHub change workflow (P1)

Tasks:
- M4.1 Validate which branch, file, commit, and PR operations the connected GitHub integration exposes.
- M4.2 Define ChatGPT branch namespace `agents/chatgpt/<task-or-session>`.
- M4.3 Define file-change limits and require reading current content/SHA before updates.
- M4.4 Standardize PR title/body with task, rationale, changed files, risk, test plan, and evidence.
- M4.5 Require Actions checks before review/merge.
- M4.6 Keep merge and auto-merge unavailable to ChatGPT automation.
- M4.7 Preserve Ledger append-only behavior and add namespace sync tests only if the existing workflow needs extension.

Acceptance:
- Changes are isolated from `main` and visible in a PR.
- PR metadata identifies the task and evidence.
- No direct main writes, merge, or auto-merge by ChatGPT.
- If connector write operations are unavailable, the documented patch/manual path works.

### M5 — Code Gate and adversarial review (P1)

Tasks:
- M5.1 Run `scripts/gate.py` in GitHub Actions on the required PR/task events.
- M5.2 Tie gate output to exact commit SHA and workflow run.
- M5.3 Store machine-readable gate evidence as workflow artifacts and/or repository evidence through a controlled workflow.
- M5.4 Define RED/missing/stale evidence blocking rules.
- M5.5 Add a human adversarial review step for security-sensitive and high-tier changes.
- M5.6 Ensure ChatGPT's own review is labeled AI-assisted, not independent approval.

Acceptance:
- Gate result is generated by a real workflow execution.
- Gate RED or missing evidence blocks handoff as policy requires.
- A green gate is not equivalent to human approval or independent adversarial acceptance.

### M6 — Pilot and operational hardening (P2)

Tasks:
- M6.1 Pilot one low-risk documentation-only PR.
- M6.2 Pilot one low-risk code PR with CI and Code Gate.
- M6.3 Test connector permission failures and fallback procedures.
- M6.4 Test unauthorized task transitions and protected-branch behavior.
- M6.5 Document runbooks for failed Actions, stale evidence, rejected PRs, and credential revocation.
- M6.6 Review whether browser-only constraints justify any future MCP or runner investment.

Acceptance:
- End-to-end workflow completes without local terminal or dedicated runner.
- All checks are traceable to GitHub workflow runs and commit SHAs.
- Human approval boundary and no-merge rule are enforced.
- Capu approves expansion beyond the pilot.

## 3. Dependency graph

```text
M0 Repository + Permissions
          |
          v
M1 Browser Operating Protocol
          |
          +----------------------+
          |                      |
          v                      v
M2 GitHub Actions CI       M3 Task Lifecycle Actions
          |                      |
          +----------+-----------+
                     |
                     v
          M4 ChatGPT-to-GitHub PR Flow
                     |
                     v
          M5 Code Gate + Adversarial Review
                     |
                     v
          M6 Pilot + Hardening
```

## 4. Explicitly deferred

- Custom MCP gateway and identity/policy services.
- Dedicated cloud runner, container/microVM isolation, queues, and workspace lifecycle.
- Multi-organization Claude/ChatGPT cross-review and independent agent credentials.
- 24/7 autonomous execution, scheduled coding agents, and automatic deployment.

Revisit these only through a new architecture decision backed by an observed requirement, usage volume, security review, and cost justification.

## 5. Rollback

- Disable the affected GitHub Actions workflow or revoke its write permission.
- Revoke or narrow the connected GitHub integration's permissions if compromised.
- Keep existing branches and PRs for human disposition; do not automatically delete user work.
- Never rewrite historical Ledger events.
- Return to patch/manual GitHub operation if connector or workflow capabilities are unavailable.

## 6. Definition of done

The browser-only operating model is ready when ChatGPT can prepare repository changes through the connected integration (or documented patch fallback), GitHub Actions executes tests and Code Gate with traceable evidence, task transitions run only through `scripts/task.py`, main is protected, and no ChatGPT automation can merge or enable auto-merge. No local terminal, custom MCP server, or dedicated runner is required.
