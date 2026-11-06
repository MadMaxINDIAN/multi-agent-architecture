<!-- Reference copy from the Remitly pilot, scrubbed on 2026-11-07. Do not use directly; see core/ for the generic version. -->
# Agent communications (`agents/comms/`)

All agent-to-agent messages go through this folder. It replaces ad-hoc chat between agents. `PROGRESS.md` stays the **summary and decision record**; this folder is the **mailbox**.

## 1. Layout

```
agents/comms/
├── README.md                    this protocol
├── TEMPLATE.md                  message template
├── inbox/
│   ├── ARCHITECT/               messages addressed to ARCHITECT
│   ├── TECH_LEAD/
│   ├── SENIOR_ENGINEER-1/       one folder per engineer instance (create when instance is added)
│   ├── SENIOR_ENGINEER-2/
│   ├── QA/                      quality assurance agent (talks to TECH_LEAD only)
│   ├── CODE_REVIEWER/           code review and code-map agent (talks to TECH_LEAD only)
│   └── FOUNDER/                 messages for the human; surfaced in PROGRESS.md §5
├── archive/                     processed messages (moved here by the receiver)
└── status/
    └── <AGENT>.md               heartbeat file, written only by that agent
```

## 2. Check cadence (mandatory)

| Agent | Check inbox at least every | Worst-case one-way delay |
|---|---|---|
| SENIOR_ENGINEER-n | **5 minutes** | 5 min |
| QA | **10 minutes** | 10 min |
| CODE_REVIEWER | **15 minutes** | 15 min |
| TECH_LEAD | **15 minutes** | 15 min |
| ARCHITECT | **30 minutes** | 30 min |

A **check** means, in this order:
1. List `inbox/<ME>/` for message files (ignore `.gitkeep`).
2. Read every file, oldest first. Act, answer or schedule the work.
3. Move each handled file to `archive/` (keep its name). Unhandled files stay in the inbox.
4. Check whether `PROGRESS.md` / `PLAN.md` changed in a way that affects your tasks.
5. Overwrite `status/<ME>.md` with the current UTC time and what you are doing.

Also check: at the start of every task, before you report a task as done, and whenever you finish a unit of work. The cadence is the **maximum** gap, not a target.

Expected round trips (plan around them): engineer → TECH_LEAD ≤ 15 min; TECH_LEAD → engineer ≤ 5 min; TECH_LEAD → ARCHITECT ≤ 30 min; engineer question that needs ARCHITECT ≤ 45 min plus answer path. So **batch questions, and keep working on the unblocked parts of a task while you wait**.

### How an agent keeps the cadence
Agents do not wake themselves. Each agent's session must be started with a recurring check, for example:

| Agent | Start command in its session |
|---|---|
| ARCHITECT | `/loop 30m check agents/comms/inbox/ARCHITECT, act on messages, update status` |
| TECH_LEAD | `/loop 15m check agents/comms/inbox/TECH_LEAD, act on messages, update status` |
| SENIOR_ENGINEER-n | `/loop 5m check agents/comms/inbox/SENIOR_ENGINEER-n, act on messages, update status` |
| QA | `/loop 10m check agents/comms/inbox/QA, act on messages, update status` |
| CODE_REVIEWER | `/loop 15m check agents/comms/inbox/CODE_REVIEWER, act on messages, update status` |

If an agent is mid-task when the timer fires, it finishes its current step, runs the check, then continues. If a session has no recurring check running, the sender cannot know; see "Liveness" below.

## 3. Message files

**Never edit a sent message. Never delete one.** To correct or follow up, send a new message that references the old one. One message = one new file, so two agents can never overwrite each other.

**File name:** `<UTC yyyymmddThhmmssZ>_<FROM>_to_<TO>_<TYPE>.md`
Example: `20261012T143005Z_SENIOR_ENGINEER-1_to_TECH_LEAD_QUESTION.md`
Write it to the **recipient's** inbox folder. Message ID = the file name without `.md` (no counters, so no collisions).

**Content:** copy `TEMPLATE.md`. Required front matter: `from`, `to`, `type`, `priority`, `ref` (task/WP/FR/ADR ids), `reply_to` (message ID or `none`), `needs_reply_by` (UTC time or `none`).

| Field | Values |
|---|---|
| `type` | `TASK` (brief) · `REPORT` · `VERDICT` · `QUESTION` · `ANSWER` · `REQUEST` · `CHANGE_REQUEST` · `BLOCKER` · `INFO` · `HANDOFF` |
| `priority` | `P0` blocks someone now · `P1` this phase · `P2` later |

Rules:
- Self-contained: the reader starts with no context. State what happened, where (paths, IDs), and exactly what you need.
- Large content (full briefs, reports, diffs) lives in a file under `docs/` or the task branch; the message links to it.
- Task briefs and reports use the formats in `agents/TECH_LEAD.md` and `agents/SENIOR_ENGINEER.md`; verdicts are exactly one of Approved / Changes requested / Rejected.
- No secrets or personal data in messages.
- Engineers, QA and CODE_REVIEWER only message TECH_LEAD. Founder-bound messages go through ARCHITECT (design) or TECH_LEAD (delivery) into `inbox/FOUNDER/`.

## 4. Replying and closing

- Answer with a new message (`type: ANSWER` or `VERDICT`) whose `reply_to` is the original ID.
- A message is **handled** when the receiver has acted on it and moved it to `archive/`. If action will take longer than one cadence interval, send a short `INFO` ("received, ETA hh:mm UTC") and archive.
- Anything with `needs_reply_by` that passes without a reply: the sender sends one `INFO` reminder, then escalates one level up the chain (engineer → TECH_LEAD → ARCHITECT/FOUNDER).

## 5. Mirror into PROGRESS.md

Messages carry the conversation; `PROGRESS.md` carries the state. The **receiver of a state-changing message updates `PROGRESS.md`** in the same step:

| Message | PROGRESS.md update |
|---|---|
| `TASK` | TECH_LEAD adds/updates the task row (§2b) |
| `REPORT` | status → `REPORTED`; append RPT entry (§7b) |
| `VERDICT` | status → `APPROVED` / `CHANGES_REQUESTED` / `REJECTED`; append REV entry (§7b) |
| `BLOCKER` | add row to §4 |
| QA defect (`REPORT` with BUG-nnnn) | TECH_LEAD adds a row to §7c (defect log) and routes the fix |
| QA verdict (`REPORT` verdict QA Pass / Pass with conditions / Fail) | TECH_LEAD records it with the WP in §2 evidence column |
| Code review verdict or finding (`REPORT` Review Clear / Clear with conditions / Blocked, CR-nnnn) | TECH_LEAD records the verdict with the task and routes each finding to the owning engineer; status in `docs/review/findings.md` |
| `CHANGE_REQUEST` that is accepted | append decision to §8 |
| founder questions | add to §5 |

## 6. Liveness

`status/<AGENT>.md` is overwritten at each check (only by that agent):

```
agent: TECH_LEAD
last_check_utc: 2026-10-12T14:30:00Z
doing: reviewing T-1.3.2
next_check_utc: 2026-10-12T14:45:00Z
```

If `last_check_utc` is older than **2 × the agent's cadence**, treat the agent as unresponsive: do not wait on it silently; send the `INFO` reminder and escalate (see §4).

## 7. Hygiene

- Inbox folders should be empty or nearly empty. More than ~10 unhandled files means the receiver is behind; tell the founder.
- Archive is kept (audit trail); do not edit it. Old archive files may be bundled by TECH_LEAD per phase into `archive/<phase>/`.
- Files are plain Markdown, UTF-8, LF line endings.
- Concurrent writes are safe because every message is a new uniquely named file. Never write into another agent's `status/` file.
