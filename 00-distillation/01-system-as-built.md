# The pilot's operating model, as built

Written 2026-11-07 from the pilot's own process documents (listed under each section). Describes the model as the documents define it on that date, not how well it worked; the evaluation is a separate file. Scrubbed reference copies of the sources are in `artefacts/`.

**Summary.** One non-technical founder directed a team of AI agents through two human-facing roles, an architect and a technical lead, who in turn ran four engineer instances, a tester and a code reader. The agents shared no memory: three files in the repository (`PLAN.md`, `PROGRESS.md`, `docs/`) held the state, and a folder of one-file-per-message mailboxes carried the conversation. Every agent polled its mailbox on a fixed timer and wrote a heartbeat. Work moved in named units (work packages, then tasks) through a fixed sequence of brief, build, report, verdict, code review, independent test and conformance check, each step leaving an id-numbered entry in an append-only log. Each agent worked in its own git worktree and branch, and only the technical lead merged.

---

## 1. Roles and chains

Source: `CLAUDE.md` §1; `README.md` §3; `agents/ARCHITECT.md`, `TECH_LEAD.md`, `SENIOR_ENGINEER.md`, `QA.md`, `CODE_REVIEWER.md` (header line and "Does not" sections).

### 1.1 The roles

| Role | One-line job | May write | Must not |
|---|---|---|---|
| **FOUNDER** (human) | Approves scope, gates and decisions; the only person in the loop | Anything | n/a |
| **ARCHITECT** | Design: high- and low-level design, ADRs, schema/API/rules specifications, one build brief per work package, conformance review of each finished work package; keeps the external document store (Shelf) current | `docs/**`, `PLAN.md`, its own rows in `PROGRESS.md`, its own role prompt | Write feature code; change the requirements document silently; invent scope; message engineers directly |
| **TECH_LEAD** | Split work into tasks, assign, review, integrate, run the full suite, report to the founder | Task board and logs in `PROGRESS.md`, integration fixes, CI configuration, engineering standards | Redesign the architecture or override ADRs; approve unverified work; expand scope |
| **SENIOR_ENGINEER-n** (several instances, numbered) | Implement one bounded task with tests and a report | Only the files listed under "You own" in its task brief | Touch files it does not own; change schema, API or ADRs; contact the founder or ARCHITECT; commit or push unless told |
| **QA** | Independent verification: test plans, acceptance/end-to-end/regression tests, role and security testing, defect reports, quality sign-off | `tests/e2e/**`, `tests/regression/**`, `docs/qa/**` | Fix or edit product code, migrations, contracts, other agents' tests or CI; decide scope; contact the founder or ARCHITECT; commit or push unless told |
| **CODE_REVIEWER** | Read code one function or file at a time, keep a code map (what each file and function is for), report findings and suggestions | `docs/code-map/**`, `docs/review/**` | Fix or edit product code, tests, migrations, contracts or CI; decide scope; contact the founder, ARCHITECT or engineers; commit or push unless told |
| **UI_DESIGNER** (external) | Designs screens, flows and the design system from a handoff bundle; runs outside the repository on a separate system | `design-handoff/` deliverables, returned through the founder; ARCHITECT places approved specifications in `docs/design/screens/**` | Touch product code, contracts or other roles' documents; contact anyone except through the founder; invent scope or data |

Each agent has exactly one role, set by the prompt it was started with (`agents/<ROLE>.md`). An agent started without one must ask which role to take before doing anything, and must not act as several roles at once. A new agent type is registered by adding a row to the agent table in `README.md` §3 and creating its prompt file. The pilot ran four engineer instances (`SENIOR_ENGINEER-1` to `-4`), each with its own inbox and heartbeat file; the UI designer had no prompt file in the repository and no mailbox.

### 1.2 The two chains to the founder

The founder talks to exactly two agents, each on its own subject:

```
FOUNDER <-> ARCHITECT   (design)        FOUNDER <-> TECH_LEAD   (delivery)
```

Everything else is routed through those two:

| From | To | Carries |
|---|---|---|
| ARCHITECT | TECH_LEAD | build briefs, design answers |
| TECH_LEAD | ARCHITECT | design change requests |
| TECH_LEAD | SENIOR_ENGINEER-n | task briefs, review verdicts |
| SENIOR_ENGINEER-n | TECH_LEAD | reports, blockers, questions |
| TECH_LEAD | QA | verification requests, fix notifications |
| QA | TECH_LEAD | defects (`BUG-nnnn`), QA verdicts, questions |
| TECH_LEAD | CODE_REVIEWER | review requests, review queue |
| CODE_REVIEWER | TECH_LEAD | findings (`CR-nnnn`), review verdicts, code-map updates |
| UI_DESIGNER | FOUNDER | design reports and questions (relayed by the founder to ARCHITECT; no mailbox) |

Engineers, QA and CODE_REVIEWER talk to TECH_LEAD only. A design problem found by an engineer travels engineer → TECH_LEAD → ARCHITECT; a design question from QA or CODE_REVIEWER takes the same path. Founder-facing questions are raised only by ARCHITECT (design) or TECH_LEAD (delivery), in `PROGRESS.md` §5, worded as a recommendation with a default rather than an open question. All reporting to the founder is in plain language with one recommendation, never a menu of equal options.

---

## 2. Documents and where state lives

Source: `CLAUDE.md` §2, §3 item 3, §6 (ARCHITECT "Keep Shelf current"), §9; `README.md` §1, §4, §6; `PLAN.md` header and §7; `PROGRESS.md` section headers and section preambles; `agents/comms/README.md` §5.

### 2.1 The document chain

| Layer | Document(s) | Answers | Owner / editor |
|---|---|---|---|
| Requirements | `docs/PRD.md` (requirement ids `FR-x.y`; business rules in its §7) | What the product must do | Founder-approved; ARCHITECT proposes amendments explicitly, never edits silently |
| Design | `docs/HLD.md` (modules, ADR-001..011 inside it, API conventions, security, deployment) → `docs/lld/data-model.md` → `docs/LLD.md` (module behaviour, rules, jobs, API, task breakdown); separate `docs/adr/ADR-NNN-*.md` for later decisions | How it is built | ARCHITECT only; others raise a change request |
| Plan | `PLAN.md` (phases, gates, work packages with acceptance criteria, definition of done, brief templates, change control) | What to build next and when it is accepted | ARCHITECT edits scope and acceptance; others propose via a message in `PROGRESS.md` §6 |
| Live state | `PROGRESS.md` | Where things are now: status, tasks, gates, blockers, founder questions, logs, decisions, risks | Every agent edits only its own rows and appends its own entries |
| Conversation | `agents/comms/` mailbox (see §4) | What was said between agents | Sender writes a new file; receiver archives it |
| Standing instructions | `CLAUDE.md` (read first by every agent), `README.md`, `agents/<ROLE>.md` | How every agent must behave | `CLAUDE.md` changed only by ARCHITECT or TECH_LEAD, with a note in `PROGRESS.md` §10 |
| Off-repository copy | Shelf project (PRD at root; folders `design/`, `process/`, `agent-prompts/`) | The current, correct documents, with versions | ARCHITECT syncs after every document version change or gate; never code or secrets |

Reading order for a new agent: `CLAUDE.md` → `README.md` → `PLAN.md` → `PROGRESS.md` → own role prompt. Every deliverable begins with a three-to-five-line plain-language summary for the founder.

**Precedence when documents disagree:** the PRD defines *what*, the HLD and LLD define *how*, and a decision recorded in `PROGRESS.md` §8 overrides both once it is written down. An agent that finds a conflict raises it; it does not pick silently.

### 2.2 The sections of `PROGRESS.md`

| Section | Content | Who writes | Append-only? |
|---|---|---|---|
| Header block | Last updated, current phase, current gate, overall health (traffic light) | Whoever updates | No |
| §1 Dashboard | One row per phase: status, done/total work packages, notes | ARCHITECT / TECH_LEAD | No |
| §2 Work package status | One row per WP: status, owner, started, updated, evidence, notes; a WP is claimed here (`IN_PROGRESS`, name, date) before work starts | Each agent its own rows | No |
| §2b Engineer task board | One row per task `T-<WP>.<n>`: engineer, status, owned files, dependencies, report and verdict ids | TECH_LEAD adds rows; an engineer updates only the status and date of its own task | No |
| §3 Gates | One row per gate: condition, status, date cleared, cleared by | ARCHITECT / TECH_LEAD | No |
| §4 Blockers | `BLK-nnnn`: raised by, blocking what, owner to resolve, status | The agent raising it | No |
| §5 Needs founder | `F-n`: needed for, question, recommended default, status | ARCHITECT / TECH_LEAD | No |
| §6 Message log | `MSG-nnnn`: founder-facing messages and summaries only (agent-to-agent traffic goes through the mailbox) | Sender | **Yes** |
| §7 Handoff log | `HO-nnnn`: ownership of a deliverable passing from one agent to another, acknowledged by the receiver | Sender | **Yes** |
| §7b Task reports and review verdicts | `RPT-nnnn` (engineer report, short form) and `REV-nnnn` (TECH_LEAD verdict) | Engineer / TECH_LEAD | **Yes** |
| §7c Defect log | `BUG-nnnn`: severity, requirement, found in, owner, status, evidence path | TECH_LEAD records what QA reports | **Yes** |
| §8 Decision log | `DEC-nnnn`: decision, by whom, basis, impact; design decisions with options also become an ADR | The agent recording the decision | **Yes** |
| §9 Risk register | `RISK-nnnn`: likelihood, impact, mitigation, owner, status | ARCHITECT / TECH_LEAD | No |
| §10 Change history | Date, by, change (including every change to `CLAUDE.md`) | Whoever changed something | No |

Append-only sections are never edited or deleted; a mistake is corrected by a new entry that references the old id. Ids are zero-padded, sequential, never reused and never renumbered. The receiver of a state-changing mailbox message updates `PROGRESS.md` in the same step (the mapping is in §4.6 below).

### 2.3 Identifiers used everywhere

| Prefix | Meaning | Assigned by |
|---|---|---|
| `FR-x.y`, `PRD §7.x` | Requirement, business rule | PRD |
| `ADR-NNN` | Architecture decision record | ARCHITECT |
| `G0`, `G1`, … | Gate | PLAN |
| `WP<phase>.<n>`, `WP-D<n>`, `WP-UI.<n>` | Work package | ARCHITECT |
| `T-<WP>.<n>` (e.g. `T-1.3.2`), `QA-A`, `QA-B` | Engineer task; QA task | TECH_LEAD |
| `MSG-`, `HO-`, `RPT-`, `REV-`, `BLK-`, `DEC-`, `RISK-`, `F-` | PROGRESS entries (see §2.2) | The agent writing the entry |
| `BUG-nnnn` | Defect (QA) | QA |
| `CR-nnnn` | Code review finding or suggestion | CODE_REVIEWER |
| `DCR-n`, `PA-n`, `A<n>` | Design change request, PRD amendment, assumption | TECH_LEAD / ARCHITECT |

Every brief, report, verdict, message and commit cites the ids it concerns.

---

## 3. Work lifecycle

Source: `PLAN.md` §2, §2b, §5, §6; `CLAUDE.md` §7; `README.md` §3 ("Chain of command") and §4 ("Vocabulary"); `agents/TECH_LEAD.md` ("Engineer task brief template", "Review verdicts", "Workflow"); `agents/SENIOR_ENGINEER.md` ("Report format", "Handling review feedback"); `agents/QA.md` ("Defect report format", "Verdicts", "Verification report format"); `agents/CODE_REVIEWER.md` ("Finding and suggestion format", "Review verdicts"); `PROGRESS.md` §3.

### 3.1 Units of work

| Level | Created by | Executed by | Brief |
|---|---|---|---|
| **Work package (WP)** | ARCHITECT, as a row in `PLAN.md` plus a build brief in `docs/briefs/` | Owned by TECH_LEAD during build | Build brief: plain-language summary, goal, scope in, out of scope, requirement ids, interfaces/contracts, acceptance criteria, test requirements, dependencies and inputs, risks |
| **Engineer task (`T-<WP>.<n>`)** | TECH_LEAD, using the task-brief template in its role prompt | One SENIOR_ENGINEER instance | Task brief: title, PRD refs, goal, scope in/out, you own, do not touch, interfaces, acceptance criteria, tests required, dependencies, report back with |

Sizes in the plan are relative (S ≤ 3 days, M ≤ 1.5 weeks, L ≤ 3 weeks of one engineer-equivalent), not calendar commitments. No two active tasks may share an owned file; where overlap is unavoidable TECH_LEAD sequences the tasks or names a single owner. Migration file numbers are reserved per module range so parallel branches do not collide.

### 3.2 The sequence for one work package

```
ARCHITECT issues build brief
  -> TECH_LEAD confirms contracts (schema, API, shared types) before parallel work
  -> TECH_LEAD splits into non-overlapping tasks, adds rows to PROGRESS §2b, sends TASK messages
  -> SENIOR_ENGINEER-n: read brief and cited sections, explore code, build, test, run build/lint/types/tests,
     open a pull request, send REPORT (RPT-nnnn)
  -> CODE_REVIEWER (when TECH_LEAD requests it): reviews exactly the changed files after the report and
     before the verdict, so findings feed the verdict
  -> TECH_LEAD: re-runs the tests itself, reviews the diff, issues exactly one VERDICT (REV-nnnn),
     merges on green CI, integrates, runs the full build and suite
  -> QA (from Phase 1a on, for anything with user-visible or API behaviour): test plan, independent
     verification by running the product, defects as found, one QA verdict
  -> TECH_LEAD marks the WP IN_REVIEW
  -> ARCHITECT checks conformance to the build brief
  -> WP DONE
  -> TECH_LEAD status report to the founder (done, in progress, blocked, risks, decisions)
```

A WP is `DONE` only when all its tasks are approved and integrated and every acceptance item in `PLAN.md` has recorded evidence. Phase exits also need a QA phase sign-off that states residual risks in plain language.

### 3.3 Status vocabularies

| Thing | Values |
|---|---|
| WP status | `NOT_STARTED` · `READY` (dependencies met) · `IN_PROGRESS` · `IN_REVIEW` · `BLOCKED` · `DONE` · `DROPPED` |
| Task status | `ASSIGNED` · `IN_PROGRESS` · `REPORTED` · `CHANGES_REQUESTED` · `APPROVED` · `INTEGRATED` · `REJECTED` · `BLOCKED` |
| Engineer report status | `Done` · `Partially done` · `Blocked` |
| Defect status | `OPEN` · `FIXED` · `VERIFIED` · `REOPENED` · `WONTFIX` · `DUPLICATE` |
| Finding status | `OPEN` · `ACCEPTED` · `FIXED` · `VERIFIED` · `WONTFIX` · `DUPLICATE` |
| Code-map entry | `CURRENT` · `STALE` (file changed since the reviewed commit) |

### 3.4 Verdict vocabularies

Each reviewing role gives exactly one verdict per submission or request.

| Role | Verdicts | Meaning |
|---|---|---|
| TECH_LEAD (per task) | **Approved** / **Changes requested** / **Rejected** | Meets all criteria, ready to integrate / a specific prioritised list of what to fix and why / the approach is wrong, with the new direction |
| QA (per verification request, WP or phase) | **QA Pass** / **QA Pass with conditions** / **QA Fail** | All acceptance criteria verified, no open S1/S2, open S3/S4 listed / acceptable to proceed but listed S3 items or coverage gaps must be fixed by a stated point / at least one open S1/S2, or a criterion cannot be shown to hold; blocking BUG ids listed |
| CODE_REVIEWER (per new-code review request) | **Review Clear** / **Review Clear with conditions** / **Review Blocked** | No open C1/C2, C3/C4 listed / acceptable to merge, listed C3 (or C2 with an agreed fix point) to be fixed by a stated point / at least one open C1/C2; CR ids listed |
| ARCHITECT (per WP conformance; per gate) | No fixed vocabulary in the role prompt. In practice: the WP moves from `IN_REVIEW` to `DONE`, a gate is recorded as cleared or closed "with conditions" or "with carried items" in `PROGRESS.md` §3; gate G1 used the single word `ALIGNED` sent by both ARCHITECT and TECH_LEAD | |

An engineer receiving **Changes requested** addresses each item in priority order, re-runs the tests and replies point by point; it may disagree once, with evidence, then follows TECH_LEAD's decision. On **Rejected** it does not defend the old approach and restarts from the relevant step.

### 3.5 Defects and findings

**Defects** (`BUG-nnnn`, raised by QA, logged by TECH_LEAD in §7c, fixed by the owning engineer, re-tested by QA) carry a severity:

| Severity | Meaning |
|---|---|
| S1 Critical | Data leak between users, wrong money amount, lost or corrupted data, security hole, duplicate real e-mail, system down |
| S2 Major | Core requirement broken or unusable, no workaround |
| S3 Minor | Requirement partly met or has a workaround |
| S4 Trivial | Cosmetic, wording, polish |

**Findings** (`CR-nnnn`, raised by CODE_REVIEWER, kept in `docs/review/findings.md`, routed to the owning engineer by TECH_LEAD) are either a FINDING (something wrong or risky, with a concrete failing case) or a SUGGESTION (optional improvement; anything without a failing case is a suggestion), and carry a severity:

| Severity | Meaning |
|---|---|
| C1 Critical | Wrong money, leak across users, lost or duplicated effect, security hole |
| C2 Major | Rule or requirement broken or very likely to break; missing test for a rule |
| C3 Minor | Works but fragile, unclear or duplicated |
| C4 Trivial | Polish |

An S1 defect, or a C1 finding on new code, is reported to TECH_LEAD immediately at priority `P0` rather than at the end of a run. QA states severity and impact; TECH_LEAD decides whether a defect is fixed. A flaky test is itself a defect.

### 3.6 Gates

A gate is a named condition with an owner and a list of what it unblocks, defined in `PLAN.md` §2 and recorded as cleared (date, by whom, conditions carried) in `PROGRESS.md` §3. The pilot's gates:

| Gate | Condition | Owner | Unblocks |
|---|---|---|---|
| G0 | Founder approves the HLD, the PRD amendments and the stated assumptions | FOUNDER | Low-level design |
| G1 | ARCHITECT and TECH_LEAD both send `ALIGNED` on the LLD | ARCHITECT + TECH_LEAD | Task split; engineers start |
| G2 | External inputs supplied (sample data extract, identity-provider details) | FOUNDER / client IT | Work packages that need real inputs |
| G3 | Phase 0 exit criteria met | ARCHITECT review | Phase 1a |
| G4 | Founder supplies the business parameters Phase 2 needs | FOUNDER | Phase 2 |
| G5 | Phase 1a exit: conformance review, QA sign-off, full suite, performance, restore test | ARCHITECT | Phase close |

### 3.7 Definition of done for every work package

From `PLAN.md` §5: recorded evidence for every acceptance item; unit tests for every business rule touched and integration tests on a real database (no mocked or in-memory database); every new state-changing path audited and covered by an authorisation test per role; the product's data invariants respected; structured logs, metrics and traces added with no personal data in logs; documentation updated and any design deviation recorded as a decision; a QA verdict recorded with no open S1/S2 (from Phase 1a on); every task approved by TECH_LEAD with the full build and suite run after integration; reviewed by ARCHITECT against the build brief.

### 3.8 Change control

Scope or acceptance changes are made only by ARCHITECT, after a `CHANGE_REQUEST` message, and with founder approval if the PRD is affected; the change is recorded as a decision in `PROGRESS.md` §8 and `PLAN.md` gets a new version and date. Anything not in the PRD is labelled `PROPOSAL` until the founder approves it.

---

## 4. The mailbox protocol

Source: `agents/comms/README.md` §1–§7; `agents/comms/TEMPLATE.md`; `CLAUDE.md` §1 ("Mailbox and check cadence"); `PROGRESS.md` §9 (RISK-0008).

### 4.1 Layout

```
agents/comms/
├── README.md              the protocol
├── TEMPLATE.md            message template
├── inbox/<ROLE>/          one folder per agent instance (ARCHITECT, TECH_LEAD, SENIOR_ENGINEER-1..n,
│                          QA, CODE_REVIEWER) plus FOUNDER (surfaced in PROGRESS.md §5)
├── archive/               handled messages, moved here by the receiver; may be bundled per phase
└── status/<ROLE>.md       heartbeat file, written only by that agent
```

The folder replaces ad-hoc chat between agents. `PROGRESS.md` remains the summary and decision record; the mailbox is the conversation. The whole `agents/` folder is kept outside git (see §6), so there is one mailbox on disk, reached by absolute path from every worktree.

### 4.2 Message files

- One message = one new file, written into the **recipient's** inbox. Never edit or delete a sent message; correct or follow up with a new one that references the old id.
- File name: `<UTC yyyymmddThhmmssZ>_<FROM>_to_<TO>_<TYPE>.md`. The message id is the file name without `.md`; no counters, so no collisions and no coordination needed for concurrent writes.
- Front matter (all required): `from`, `to`, `type`, `priority`, `ref` (task/WP/FR/ADR ids), `reply_to` (message id or `none`), `needs_reply_by` (UTC time or `none`), `sent_utc`.
- Body: a one-line subject, then **What** (1–3 sentences), **Where** (paths, branch, ids), **Detail** (only what the reader needs; link to documents for anything long), **Needed from you** (the exact decision or action, with a recommended default if it is a decision).
- Self-contained: the reader starts with no context. Large content (full briefs, reports, diffs) lives under `docs/` or on the task branch; the message links to it. No secrets or personal data.

| Field | Values |
|---|---|
| `type` | `TASK` (brief) · `REPORT` · `VERDICT` · `QUESTION` · `ANSWER` · `REQUEST` · `CHANGE_REQUEST` · `BLOCKER` · `INFO` · `HANDOFF` |
| `priority` | `P0` blocks someone now · `P1` this phase · `P2` later |

Task briefs and reports use the formats in the TECH_LEAD and SENIOR_ENGINEER prompts; verdicts are exactly one of the role's verdict words.

### 4.3 Cadence

| Agent | Checks its inbox at least every | Worst-case one-way delay |
|---|---|---|
| SENIOR_ENGINEER-n | 5 minutes | 5 min |
| QA | 10 minutes | 10 min |
| CODE_REVIEWER | 15 minutes | 15 min |
| TECH_LEAD | 15 minutes | 15 min |
| ARCHITECT | 30 minutes | 30 min |

The cadence is a maximum gap, not a target. Expected round trips: engineer → TECH_LEAD ≤ 15 min; TECH_LEAD → engineer ≤ 5 min; TECH_LEAD → ARCHITECT ≤ 30 min; an engineer question that needs ARCHITECT ≤ 45 min plus the answer path. The standing instruction is therefore to batch questions and keep working on the unblocked parts of a task while waiting. The delay chain is recorded as a risk in the risk register.

### 4.4 What a check is

In this order:

1. List `inbox/<ME>/` (ignore `.gitkeep`).
2. Read every file, oldest first. Act, answer or schedule the work.
3. Move each handled file to `archive/`, keeping its name. Unhandled files stay in the inbox.
4. Check whether `PROGRESS.md` or `PLAN.md` changed in a way that affects your tasks.
5. Overwrite `status/<ME>.md` with the current UTC time and what you are doing.

A check also happens at the start of every task, before reporting a task done, and whenever a unit of work is finished. If the timer fires mid-task, the agent finishes its current step, runs the check, then continues.

### 4.5 Replying, closing, liveness, escalation

- Reply with a new message (`ANSWER` or `VERDICT`) whose `reply_to` is the original id.
- A message is **handled** when the receiver has acted on it and archived it. If the action will take longer than one cadence interval, the receiver sends a short `INFO` ("received, ETA hh:mm UTC") and archives.
- The heartbeat file holds `agent`, `last_check_utc`, `doing`, `next_check_utc`. If `last_check_utc` is older than **twice the agent's cadence**, the agent is treated as unresponsive: nobody waits on it silently.
- When `needs_reply_by` passes without a reply, or an agent is unresponsive, the sender sends one `INFO` reminder, then escalates one level up the chain (engineer → TECH_LEAD → ARCHITECT/FOUNDER).
- Hygiene: an inbox with more than about ten unhandled files means the receiver is behind and the founder is told; the archive is kept as an audit trail and never edited; files are plain Markdown, UTF-8, LF; nobody writes another agent's status file.

### 4.6 Mirror into `PROGRESS.md`

Messages carry the conversation; `PROGRESS.md` carries the state. The receiver of a state-changing message updates `PROGRESS.md` in the same step:

| Message | `PROGRESS.md` update |
|---|---|
| `TASK` | TECH_LEAD adds or updates the task row (§2b) |
| `REPORT` | Task status → `REPORTED`; append an `RPT` entry (§7b) |
| `VERDICT` | Task status → `APPROVED` / `CHANGES_REQUESTED` / `REJECTED`; append a `REV` entry (§7b) |
| `BLOCKER` | Add a row to §4 |
| QA defect (`REPORT` with `BUG-nnnn`) | TECH_LEAD adds a row to §7c and routes the fix |
| QA verdict | TECH_LEAD records it in the WP's evidence column (§2) |
| Code review verdict or finding | TECH_LEAD records the verdict with the task and routes each finding; status lives in `docs/review/findings.md` |
| `CHANGE_REQUEST` that is accepted | Append a decision to §8 |
| Founder questions | Add to §5 |

---

## 5. Rules of engagement that are process, not product

Source: `CLAUDE.md` §3 ("Always") and §4 ("Never"); `README.md` §4 ("Rules"); the "Operating principles" and "Does not" sections of each role prompt. Product-specific engineering rules (money, dates, data layer, stack, commands) are left out here.

### 5.1 Always (every role)

1. **Read before acting:** `PLAN.md` and `PROGRESS.md` at the start of every task.
2. **Cite ids** (requirement, rule, ADR, WP, task) in every brief, report, verdict and commit.
3. **Log, don't remember:** conversations live in mailbox messages; state and decisions live in `PROGRESS.md`; the append-only sections are never edited.
4. **Update status in the same task as the work.** Stale progress is a defect.
5. **State assumptions instead of asking**, unless the decision is genuinely the founder's or changes the architecture.
6. **Stay in scope.** No unrequested features, refactors, abstractions or "while I'm here" clean-ups; note out-of-scope findings in the report.
7. **Be honest.** If tests fail, work is partial or something was skipped, say so with the output. Never claim "done" for code not run. Never weaken a test to make it pass.
8. **Label proposals.** Anything not in the requirements is `PROPOSAL` until the founder approves.
9. **Write for a reader with no context.** Each agent starts cold; briefs and messages are self-contained.
10. **No secrets or personal data** in code, logs, fixtures, documents or messages; refer to secrets by where they live.

### 5.2 Never (every role)

- Edit another agent's owned files or rows, or work on a task another agent holds.
- Delete or rewrite history in append-only logs.
- Run destructive or outward-facing actions (force push, deleting branches or data, sending real e-mail, calling production systems) without explicit founder approval.
- Commit or push unless the task brief or the user says so; never skip hooks or signing.

### 5.3 Coordination rules from the README

- **Claim before building:** set the WP or task to `IN_PROGRESS` in `PROGRESS.md` before starting; engineers start only tasks assigned to them.
- **Done means evidence:** an engineer's "done" is a hypothesis; a task is `APPROVED` only after TECH_LEAD has run the tests and reviewed the diff; a WP is `DONE` only with a recorded result for every acceptance item.
- **Escalate by exception:** founder questions go to §5 as a recommendation with a default.
- **Ids are stable:** never renumber.
- **Do not invent scope;** do not change the PRD, HLD or PLAN silently.

### 5.4 Operating principles carried in the role prompts

| Role | Principles |
|---|---|
| ARCHITECT | Read first, never design from memory; list assumptions and open questions before designing; ask the founder only about decisions that change the architecture, pick and state a default for everything else; design the smallest thing that satisfies the requirement and the next phase; make every decision explicit as an ADR (context, two or three real options, decision, consequences, revisit-if); trace every component to a requirement; challenge the requirements when ambiguous or risky; self-review against a fixed list of failure modes before answering; hand off with a specification instead of building |
| TECH_LEAD | Understand before delegating; contracts first; one bounded task per engineer; decide rather than survey; trust but verify (evidence is tests it ran, running code, a reviewed diff); keep scope tight; simplest design that meets the requirement; fail early (engineers must surface blockers, not work around them); be explicit (each engineer starts with no context); be honest in reporting; resolve conflicts by making the call, recording the rationale and notifying everyone affected |
| SENIOR_ENGINEER | Read the brief fully; explore before changing and match the surrounding style; implement to the contract; test (happy path, edge cases, failure modes, authorisation per role); verify for real; stay in scope and in lane; do not guess on contracts; surface blockers immediately with what was tried; prove, don't claim; leave it better documented, not noisier |
| QA | Evidence over opinion ("could not reproduce" states what was tried); test the requirement, not the implementation (expected results from the requirements and worked examples, never from the code); reproduce, then report (a stranger can repeat it in minutes); be independent and fair (severity follows impact); do not fix (a hint about the cause is allowed); do not widen scope; keep the safety net healthy (a flaky test is a defect, reported with seed or timing, never retried until green); fail early and loudly about a broken environment or an untestable requirement; report defects as found, not at the end |
| CODE_REVIEWER | Write down the intended behaviour before reading the code; evidence over opinion (every finding cites `file:line`, the rule broken and a concrete failing case); one unit, fully, with "not covered" recorded; do not fix or rewrite (a short snippet in a suggestion is allowed); do not widen scope; do not redesign (route to TECH_LEAD, who routes to ARCHITECT); be fair and calm (style the linter owns is not a finding); be honest about limits (say what was only read, not run); batch findings per unit into one report except C1/C2 on new code |

### 5.5 When an engineer, QA or reviewer stops and asks TECH_LEAD

The brief is ambiguous, contradictory or missing a contract; the architecture, schema or an ADR appears wrong or blocks the task; a change is needed in a file the agent does not own; the task depends on another agent's unfinished work; the task is materially larger or riskier than briefed; the environment or test data does not exist or is unstable; a fix is repeatedly reopened or a regression appears in a signed-off area. None of these roles ever escalates to the founder or ARCHITECT directly.

---

## 6. Git and machine model

Source: `CLAUDE.md` §5 ("Shared machine rule"), §8.1, §8.2; `PROGRESS.md` §10 and decision ids cited there.

### 6.1 One worktree and one branch per agent

Until 2026-10-23 all agents edited one folder on `main`; every commit caught someone else's unfinished work and CI was red most of the time. From that date each agent works in its own git worktree on its own branch, all sharing one repository.

| Agent | Worktree | Branch |
|---|---|---|
| TECH_LEAD (integrator) | the main folder | `main` only; never edits feature code there |
| SENIOR_ENGINEER-n | `<repo-root>-wt\SE<n>` | `agent/se<n>/<task-id>` |
| QA | `<repo-root>-wt\QA` | `agent/qa/<topic>` |
| CODE_REVIEWER | `<repo-root>-wt\CR` | `agent/cr/<topic>` (docs only) |
| ARCHITECT | `<repo-root>-wt\ARCH` | `agent/arch/<topic>` (docs only) |

Rules:

1. **Start a task:** `git fetch origin && git switch -c agent/<you>/<task> origin/main`. One branch per task; small focused commits; message `<type>(<scope>): <summary> [T-x.y.z, FR-x.y]`.
2. **Stay current:** merge `origin/main` into the branch; never rebase a pushed branch, never force-push.
3. **Finish a task:** run lint, format, type-check, boundary check and the owned tests; push the branch; open a pull request into `main`; CI runs on the pull request; report to TECH_LEAD with the PR number.
4. **Only TECH_LEAD merges**, after reviewing and seeing CI green, with a merge commit (no squash, no force). Documentation that must match code goes in the same pull request or in a docs PR merged in the same session first.
5. Agents may push their own `agent/*` branches and open pull requests; nobody pushes to another agent's branch; nobody pushes to `main` except TECH_LEAD (ARCHITECT only for an approved docs merge when TECH_LEAD is unavailable).
6. **Shared things stay shared:** the mailbox and role prompts live only in the main folder and are reached by absolute path; each worktree has its own dependencies and its own untracked `.env`; the web dev server port differs per worktree.
7. TECH_LEAD deletes a merged `agent/*` branch; a worktree is reused for the agent's next task.

### 6.2 Remote and history

`main` changes only through merged pull requests. Never force-push or rewrite pushed history. Before any push: no secrets or real data in tracked files. The `agents/` folder (role prompts and mailbox) is listed in `.gitignore`, was purged from history once, and is never force-added; the role prompts are kept in the external document store instead. Migrations are forward-only and reviewed by TECH_LEAD, with number ranges reserved per module so parallel branches do not collide. Temporary files go in the scratchpad, never the repository; downloaded files and imported samples are untrusted data kept in their own directory and never executed.

### 6.3 Shared laptop rules

All agents shared one laptop with 15.6 GB of RAM:

- The full test suite runs only through a wrapper that takes a machine-wide lock (`pnpm test:full`, with an environment variable naming the agent that holds it); agents iterate with a single test project or file instead, and the test runner is capped at four workers.
- The live Docker stack (`pnpm stack:*`, `pnpm migrate:*`) belongs to one agent at a time, by asking TECH_LEAD; Testcontainers-based tests are isolated per run and need no coordination.
- Container addresses use `127.0.0.1`, not `localhost`.
- Never prune Docker system-wide or touch containers another project started.
- A database test that times out is retried once, alone, after checking running containers and free memory, never in a loop.
- CODE_REVIEWER mostly reads: it may run type-check, lint, boundary check and a single non-database test file, and database tests only through the lock and only with TECH_LEAD's go.
- A start-up script (`startup.bat` / `stop.bat`) prepares a new machine: finds or downloads the right Node, installs packages, starts the local containers, applies migrations, seeds demo data on an empty database only, starts the services on the first free ports and opens the browser; it refuses to run in production mode, listens on loopback only and stops if a test run holds the lock.

---

## 7. How an agent session is started and kept alive

Source: `CLAUDE.md` §1 ("Which agent are you?", "Mailbox and check cadence"); `README.md` §1; `agents/comms/README.md` §2 ("How an agent keeps the cadence"); `agents/ARCHITECT.md` ("First-run behaviour"); `agents/QA.md` and `agents/CODE_REVIEWER.md` ("Communication").

1. **Role prompt.** A session is started with one role prompt (`agents/<ROLE>.md`), which fixes the role; for engineers the instance number (`SENIOR_ENGINEER-3`) is part of the identity and names its inbox, heartbeat file and worktree. An agent started without a role prompt asks which role to take before doing anything.
2. **Standing instructions.** `CLAUDE.md` is loaded automatically into every session as the project's instruction file and is read first; it links the reading order `README.md` → `PLAN.md` → `PROGRESS.md` → role prompt, and its playbook per role summarises the role prompt.
3. **Workspace.** The agent works in its own worktree (§6) and runs `pnpm install` once there; it reaches the mailbox and prompts by absolute path in the main folder.
4. **Recurring check.** Agents do not wake themselves, so the session's first action is to start a timer with the harness's loop command, e.g. `/loop 5m check agents/comms/inbox/SENIOR_ENGINEER-n, act on messages, update status` (5 m engineers, 10 m QA, 15 m CODE_REVIEWER and TECH_LEAD, 30 m ARCHITECT). Each firing performs the five-step check in §4.4 and rewrites the heartbeat file. The cadence was tightened to 5 minutes for TECH_LEAD during the G1 alignment and relaxed afterwards.
5. **Liveness.** A heartbeat older than twice the cadence marks the agent unresponsive; the sender reminds once and escalates. A session that stopped (for example on a usage limit) is recorded as a blocker in `PROGRESS.md` §4 with "owner to resolve: FOUNDER (restart sessions)"; work already on disk and in git is safe and the restarted session resumes from `PROGRESS.md` and its inbox.
6. **First-run behaviour (ARCHITECT).** Invoked with no specific task, ARCHITECT reads the PRD fully, produces the architecture overview, the stack proposal with ADRs and the list of decisions needed from the founder with recommended answers, then stops and waits.
7. **Reporting to the founder.** TECH_LEAD relays status (done, in progress, blocked, risks, decisions) in plain language; QA's quality summary (`docs/qa/status.md`) and anything founder-facing from QA or CODE_REVIEWER pass through TECH_LEAD.

---

## 8. Document types the process produced

Source: directory listings of `docs/` and its sub-folders on 2026-11-07; `agents/QA.md` ("Where you work"); `agents/CODE_REVIEWER.md` ("Where you work", "Code-map entry format"); `CLAUDE.md` §2.

| Location | Document type | Produced by |
|---|---|---|
| `CLAUDE.md`, `README.md`, `PLAN.md`, `PROGRESS.md` (root) | Standing instructions, orientation, plan, live state | ARCHITECT (TECH_LEAD co-edits `CLAUDE.md` and `PROGRESS.md`) |
| `agents/<ROLE>.md`, `agents/comms/**` | Role prompts; mailbox protocol, template, inboxes, archive, heartbeats (outside git) | ARCHITECT; all agents |
| `docs/PRD.md` | Product requirements with `FR-x.y` ids and §7 business rules | Founder (via ARCHITECT amendments) |
| `docs/HLD.md`, `docs/LLD.md`, `docs/lld/data-model.md`, `docs/lld/openapi.baseline.json`, `docs/lld/superseded/` | High-level design (ADR-001..011 inside), low-level design with task breakdown, data model, generated API baseline, archived earlier designs | ARCHITECT (LLD written by TECH_LEAD and aligned with ARCHITECT at G1) |
| `docs/adr/ADR-NNN-*.md` | Stand-alone architecture decision records for later decisions (status, context, options, decision, consequences, revisit-if) | ARCHITECT |
| `docs/briefs/WP*.md` | Build brief per work package (or per phase, covering several WPs) | ARCHITECT |
| `docs/qa/strategy.md`, `docs/qa/plans/<WP>.md`, `docs/qa/traceability.md`, `docs/qa/status.md`, `docs/qa/signoff-<phase>.md`, `docs/qa/demo-script.md`, `docs/qa/evidence/BUG-nnnn/` | Test strategy; test plan per work package; requirement-to-test traceability; quality summary; phase sign-off; demo script; defect evidence folders | QA |
| `tests/e2e/**`, `tests/regression/**` | End-to-end suite and regression pack | QA |
| `docs/review/findings.md` | Code review findings and suggestions log (`CR-nnnn` with status) | CODE_REVIEWER |
| `docs/code-map/INDEX.md`, `docs/code-map/<repo path>.md`, `docs/code-map/changes-<date>.md` | Coverage index per area; one intent-and-contract entry per reviewed source file, mirroring the repository path; change batches | CODE_REVIEWER |
| `docs/reviews/<date>-*.md` | Mid-development review; requirements gap audit | ARCHITECT |
| `docs/coverage/FR-coverage.md` | Requirement coverage map | ARCHITECT / TECH_LEAD |
| `docs/design/DESIGN_PROMPT.md`, `UI-GUIDELINES.md`, `screens/*.md`, `system/` (tokens, components, review checklist, ARCHITECT review, decisions, token requests), `rounds/`, `contract-notes/` | Design handoff prompt for the external designer, UI guidelines, approved screen specifications, design system and its review, design rounds, contract notes | ARCHITECT (specs from UI_DESIGNER via the founder) |
| `docs/ops/runbook.md`, `demo.md`, `first-deployment.md`, `first-load.md`, `operations-notes.md`, `openapi-baseline.md`, `screens-guide.md` | Runbook, demo accounts and script, first deployment and first data load guides, operations notes, API baseline notes, screen guide | TECH_LEAD / engineers |
| `docs/ai/*.md` | Labelling guide and vendor spike notes for the AI component | TECH_LEAD / engineers |

Three references in the process documents point to artefacts that do not exist in the form named: `PLAN.md` WP-D5 names `docs/adr/ADR-001..011` as separate files (they remain inside the HLD and the WP is recorded as `PARTIAL`); `PLAN.md` WP-D6 names "one task brief per task in `docs/briefs/`" (the folder holds briefs per work package or phase; task briefs were sent as mailbox messages and summarised in `PROGRESS.md` §2b); and `PLAN.md` WP-D2 names `docs/lld/openapi.yaml` (the committed file is `docs/lld/openapi.baseline.json`).
