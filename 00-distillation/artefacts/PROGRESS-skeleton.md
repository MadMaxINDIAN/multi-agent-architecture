<!-- Reference copy from the Remitly pilot, scrubbed on 2026-11-07. Do not use directly; see core/ for the generic version. -->
<!-- Skeleton only: section headers, the dashboard block, table column headers and at most two example rows per table. Product details replaced by <...>. Extracted from PROGRESS.md (618 lines) on 2026-11-07. -->
# PROGRESS

Live status and agent communication log for <product>. **Read `README.md` §4 for the editing rules before changing this file.** Append-only sections (§6–§8) are never edited or deleted; correct mistakes with a new entry that references the old ID.

| | |
|---|---|
| **Last updated** | <YYYY-MM-DD> by <ROLE> (<reason>) |
| **Current phase** | <phase and milestone summary, with DEC ids> |
| **Current gate** | <gates cleared; gates open or deferred; next milestone and code-freeze date> |
| **Overall health** | 🟢/🟡/🔴 <one line: product status, delivery risks, process changes with DEC ids> |

---

## 1. Dashboard

| Phase | Status | Done / Total WPs | Notes |
|---|---|---|---|
| Design | 🟢 Done | <n> / <n> | <HLD, data model, LLD, ADR versions> |
| 0 Foundations | 🟢 Done | <n> / <n> | <gate cleared, date> |

Legend: ⚪ not started · 🟡 in progress · 🟢 done · 🔴 blocked

## 2. Work package status

Each agent updates **only its own rows**. Claim a package here (`IN_PROGRESS`, name, date) before starting.

| WP | Title | Status | Owner | Started | Updated | Evidence / link | Notes |
|---|---|---|---|---|---|---|---|
| WP-D1 | LLD: data model | DONE | ARCHITECT | <YYYY-MM-DD> | <YYYY-MM-DD> | `docs/lld/data-model.md` v<n> | |
| WP1.1 | <feature title> | DONE | TECH_LEAD | <YYYY-MM-DD> | <YYYY-MM-DD> | QA Pass | |

Statuses: `NOT_STARTED` · `READY` · `IN_PROGRESS` · `IN_REVIEW` · `BLOCKED` · `DONE` · `DROPPED`

## 2b. Engineer task board

Owned by TECH_LEAD, who adds rows when decomposing a WP. An engineer updates only the status and "Updated" of their own task. `Owns` lists files/modules exclusively that engineer's; no two active tasks may share an owned file.

| Task | WP | Title | Engineer | Status | Owns (files/modules) | Depends on | Updated | Report | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| T-0.1.1 | WP0.1 | <task title> | SENIOR_ENGINEER-1 | APPROVED (<commit>) | <paths/globs this engineer owns> | G1 | <YYYY-MM-DD> | | |
| QA-A | WP1.3 | Independent verification of <area> | QA | DONE: QA Pass with conditions (BUG-0001..0003) | `tests/regression`, `docs/qa` | — | <YYYY-MM-DD> | REPORT <message id> | accepted |

## 3. Gates

| Gate | Condition | Status | Date cleared | Cleared by |
|---|---|---|---|---|
| G0 | Founder approves HLD, PRD amendments, assumptions | ✅ Cleared (<how; residual open items>) | <YYYY-MM-DD> | FOUNDER |
| G1 | ARCHITECT and TECH_LEAD both send `ALIGNED` on the LLD; only then TECH_LEAD splits tasks and starts engineers | ✅ Cleared. ARCHITECT ALIGNED (<message id>) + TECH_LEAD ALIGNED (<message id>, LLD v<n>, all conditions verified) | <YYYY-MM-DD> | ARCHITECT + TECH_LEAD |

## 4. Blockers

| ID | Raised by | Date | Blocking | Description | Owner to resolve | Status |
|---|---|---|---|---|---|---|
| BLK-0001 | ARCHITECT | <YYYY-MM-DD> | <task/review ids> | <what is stuck and why; where the work is safe> | FOUNDER (<action>) | CLEARED <YYYY-MM-DD> (<how>) |

## 5. Needs founder

Worded as a recommendation with a default. If the founder says "defaults are fine", the default applies.

| # | Needed for | Question | Recommended default | Raised | Status |
|---|---|---|---|---|---|
| F-1 | G0 | <question, with the document section it comes from> | <default> | <YYYY-MM-DD> | DECIDED <YYYY-MM-DD> (see DEC-NNNN) |
| F-4 | G2 | <external input needed> | <default> | <YYYY-MM-DD> | OPEN |

## 6. Message log (append-only)

Use this for **founder-facing** messages and summaries. Agent-to-agent messages go in `agents/comms/inbox/<ROLE>/` (see `agents/comms/README.md`); the receiver mirrors state changes here and in §2b/§4/§7b/§8. Newest at the bottom.

**Entry format**

```
### MSG-NNNN · YYYY-MM-DD · FROM → TO · TYPE · Priority
Re: WP/FR/ADR ids
<what / where / what you need, in 2–6 lines>
Status: OPEN | ANSWERED by MSG-NNNN | CLOSED
```

### MSG-0001 · <YYYY-MM-DD> · ARCHITECT → FOUNDER · REQUEST · P0
Re: G0, <document sections>
<request in 2–6 lines>
Status: <OPEN | ANSWERED by MSG-NNNN | CLOSED>

## 7. Handoff log (append-only)

A handoff passes ownership of work or a deliverable from one agent to another. The sender writes it; the receiver acknowledges by appending a message (`ANSWER`) and updating §2.

**Entry format**

```
### HO-NNNN · YYYY-MM-DD · FROM → TO
WP: <id>   Deliverable: <path(s)>
Inputs the receiver needs: <files, decisions, credentials location (never the secret)>
Acceptance: <copy from PLAN.md or the build brief>
Out of scope: <list>
Open questions / known risks: <list>
Acknowledged: PENDING | MSG-NNNN
```

*(none yet)*

## 7b. Task reports and review verdicts (append-only)

Engineer reports use the format in `agents/SENIOR_ENGINEER.md`; verdicts follow `agents/TECH_LEAD.md`. Keep entries short here: put full detail in the linked file or PR, and record the evidence (commands run, results).

**Report entry**

```
### RPT-NNNN · YYYY-MM-DD · SENIOR_ENGINEER-n → TECH_LEAD
Task: T-x.y.z   Status: Done | Partially done | Blocked
Summary / Files touched / Acceptance (met or not, with evidence) / Test results
Deviations from brief / Open questions and risks / Out-of-scope issues noticed
```

**Verdict entry**

```
### REV-NNNN · YYYY-MM-DD · TECH_LEAD → SENIOR_ENGINEER-n
Task: T-x.y.z   Re: RPT-NNNN   Verdict: Approved | Changes requested | Rejected
<prioritised, specific list when not Approved>
```

### RPT-0001 · <YYYY-MM-DD> · SENIOR_ENGINEER-1 → TECH_LEAD
Task: T-0.1.1   Status: Done
<one-line summary; commands run and counts; deviations>. Full report: agents/comms/archive/<message id>.md

### REV-0001 · <YYYY-MM-DD> · TECH_LEAD → SENIOR_ENGINEER-1
Task: T-0.1.1   Re: RPT-0001   Verdict: Approved
<what TECH_LEAD re-ran and the results; follow-up tasks assigned>

## 7c. Defect log (append-only; TECH_LEAD records, QA reports)

QA reports defects as `BUG-nnnn` (format and severity S1–S4 in `agents/QA.md`). TECH_LEAD adds a row when a report arrives and updates the status; fixes are verified by QA.

| ID | Sev | Summary | Requirement | Found in | Owner | Status | Evidence |
|---|---|---|---|---|---|---|---|
| BUG-0001 | S4 | <one-line summary> | <PRD §7.x / FR-x.y / ADR / LLD §> | <WP, package version, commit> | SENIOR_ENGINEER-n (T-x.y.z) | VERIFIED by QA (<commit>) | docs/qa/evidence/BUG-0001/ |
| BUG-0004 | S3 | <one-line summary> | <refs> | <WP, task, commit> | SENIOR_ENGINEER-n (T-x.y.z) | OPEN | docs/qa/evidence/BUG-0004/ |

## 8. Decision log (append-only)

Records decisions that change scope, design or plan. Design decisions with options and consequences also become an ADR in `docs/adr/`.

| ID | Date | Decision | By | Basis | Impact |
|---|---|---|---|---|---|
| DEC-0001 | <YYYY-MM-DD> | <decision in one line> | FOUNDER | <HLD/ADR/PRD ref> | <what changes as a result> |
| DEC-0002 | <YYYY-MM-DD> | <decision in one line> | FOUNDER (defaults accepted) | <PRD §17 question; ADR> | <WP ordering effect> |

## 9. Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| RISK-0001 | <risk in one line> | Medium | High | <mitigation; linked F-n or design ref> | FOUNDER / ARCHITECT | Open |
| RISK-0008 | Agents only check mail on a timer; chained delays (engineer → TECH_LEAD → ARCHITECT) can reach 45+ min, and an agent without a running `/loop` is silent | Medium | Medium | Batch questions; work on unblocked parts; heartbeat in `comms/status/`; escalate when heartbeat older than 2× cadence | TECH_LEAD | Open |

## 10. Change history

| Date | By | Change |
|---|---|---|
| <YYYY-MM-DD> | ARCHITECT | Created README.md, PLAN.md, PROGRESS.md; recorded HLD v<n> and founder defaults |
| <YYYY-MM-DD> | ARCHITECT | Added comms protocol (`agents/comms/`), check cadence (DEC-NNNN), RISK-NNNN; updated CLAUDE.md and README.md |
