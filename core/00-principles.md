# Principles

Thirteen rules every variant obeys. Each comes from something that worked or broke in the pilot (`00-distillation/02-evidence-from-remitly.md`, cited as *Evidence §n*) or is marked as an assumption. Everything else in `core/` is a consequence of these.

| # | Principle | In one sentence |
|---|---|---|
| P1 | Roles, not people | An agent is a role prompt plus a file scope plus a list of who it may talk to. |
| P2 | The record is a file; the wake-up is a signal | Messages are immutable files; any faster delivery only tells the receiver to go and read. |
| P3 | One home per fact | State lives on the board, decisions in the decision log, conversation in messages, ownership in the registry; nowhere else. |
| P4 | Same protocol on every runtime | One laptop, three laptops or a supervisor: the message, board and gate formats do not change. |
| P5 | Everything cites an identifier | Requirements, decisions, tasks, defects, findings and messages have ids; a statement without one is an opinion. |
| P6 | Authors never verify their own work | The engineer, the reviewer, the tester and the role that issues the verdict are different roles. |
| P7 | Bounded tasks, exclusive ownership | A task names the files it owns; no two active tasks share a file; no task crosses a team boundary. |
| P8 | Honesty over progress | Partial is reported as partial, failing tests are shown, nothing is "done" that was not run. |
| P9 | Humans gate scope, money and the irreversible | Agents gate everything else. |
| P10 | Scale by adding a level, never by widening a hub | No role has more than five direct reports; when it would, split it. |
| P11 | Idle agents cost | Start a role when there is work in its inbox; stop it when there is none. |
| P12 | Measure the process from its own artefacts | Latency, overhead and liveness are computed from message timestamps and board transitions, not from memory. |
| P13 | Pull before ask | Publish what other teams will need (module card, contracts, docs) so most cross-team questions never become messages. |

## P1. Roles, not people

Every agent runs from a role prompt in `core/roles/`, a scope of files it may write (given in its task brief or role prompt), and the communication rules in `01-organisation.md`. A role may be held by a different session tomorrow with no loss, because nothing lives in the session: the role's inbox, the board and the logs carry everything (P3).

*Forbids:* instructions given "in chat" that are not in a brief or a message; one session acting as two roles that would verify each other (multiplexing rules, `01-organisation.md §6`).
*Evidence:* the pilot ran eight role sessions for four weeks and restarted several of them; work resumed from the board and the mailbox each time (*Evidence §8*).

## P2. The record is a file; the wake-up is a signal

A message exists when its file exists in `comms/messages/`. Delivery mechanisms (a session-to-session ping, a file watcher, a queue) only shorten the time until the receiver reads the file; they never carry content, and they may be lost without losing the message.

*Forbids:* content that exists only in a ping, a chat window or a session's memory; "I told you earlier".
*Evidence:* the pilot's file mailbox gave a complete audit trail of 1,947 messages, but polling it on a timer cost 5–30 minutes per hop (*Evidence §2*). The fix is to add a signal, not to replace the file.

## P3. One home per fact

| Fact | Home | Written by |
|---|---|---|
| What is being built, in what order | `PLAN.md` (team) and `PROGRAM.md` (programme) | TL / DL |
| Status of every work package and task | `PROGRESS.md` (team board) | the role named by the message mapping in `03-messaging.md §4` |
| Decisions | the decision log (append-only) | the role with the decision right |
| Conversation | `comms/messages/` | anyone, through `maa send` |
| Who owns which module, repository and contract | `registry/` | CA (modules), DL (roles) |
| Requirements | the module PRD | PM |

*Forbids:* decisions recorded only in a message; status recorded only in a status file; duplicate copies of the board.
*Evidence:* the pilot kept state on the board and conversation in the mailbox and survived restarts; where the two drifted (unlogged `GO` / `FROZEN` messages, *Evidence §5*) agents lost time reconstructing state.

## P4. Same protocol on every runtime

The message format, the board sections, the gate names and the role prompts are identical in v1, v2 and v3. A variant may only change the **transport** (how a file reaches a machine and how a receiver is told) and the **scheduler** (who starts and stops sessions).

*Forbids:* a variant that adds a message type, a board column or a gate without changing `core/` first.
*ASSUMPTION:* this is what lets a product start on one laptop and move to a supervisor without rewriting its history. Not yet proven by a migration; the first v1 → v2 move will test it.

## P5. Everything cites an identifier

`FR-<MOD>-x.y`, `ADR-<scope>-nnn`, `WP-<TEAM>-n`, `T-<TEAM>-n.m`, `DEC-<scope>-nnnn`, `BUG-<TEAM>-nnnn`, `CR-<TEAM>-nnnn`, message ids. Briefs, reports, verdicts, commits and pull requests cite them.

*Forbids:* renumbering; reusing an id; a brief with no requirement id; a commit message with no task id.
*Evidence:* the pilot's ids let anyone trace a merged pull request back to the requirement and the decision that shaped it; its 100 logged decisions were cited by id in later messages (*Evidence §7*).

## P6. Authors never verify their own work

An engineer reports; a reviewer reads the code; QA runs the product; the team lead issues the one verdict; the domain architect checks conformance. These are different roles, and the multiplexing rules say which may never share a session.

*Forbids:* an engineer marking a task done; a lead approving work whose tests it did not run; a reviewer fixing the code it reviews.
*Evidence:* the pilot's rule "never approve unverified work" held throughout; defects were found by QA and the reviewer, not by the author (*Evidence §9*).

## P7. Bounded tasks, exclusive ownership

A task brief lists **You own** (files the engineer may change) and **Do not touch**. No two active tasks in a team share a file. No task changes a contract another team consumes; that is a contract change (`05-repos-and-contracts.md §4`).

*Forbids:* "while I am here" edits; refactors not in a brief; a task that spans two repositories without a contract step in between.
*Evidence:* until the pilot moved to one worktree and one branch per agent, every commit caught someone else's unfinished work and CI was red most of the time (*Evidence §7*, worktree decision).

## P8. Honesty over progress

A report states what was run and what the output was. "Done" means built, tested, output shown. Tests are never weakened to pass. A skipped step is named.

*Forbids:* claiming done for code not executed; hiding a failing test; an estimate presented as a result.
*Evidence:* the pilot's reports included command output, which is what let the lead and QA verify instead of trust (*Evidence §9*).

## P9. Humans gate scope, money and the irreversible

The founder (or a named human delegate) approves: scope and roadmap changes, the agent budget, the first release of a product, deleting data, force-pushing, sending anything to a real external system. Everything else is decided by the role with the decision right (`01-organisation.md §4`).

*Forbids:* an agent deciding scope because the founder was slow; an agent exceeding the session or cost budget "to finish".
*Evidence:* items in the pilot's "needs founder" queue blocked a phase while they waited (*Evidence §6*). The fix is a Head of Product who can answer most scope questions inside an approved roadmap, not fewer human gates.

## P10. Scale by adding a level, never by widening a hub

Span of control is at most five direct reports for any lead role. When a lead's verdict queue or inbox age breaches its service level for two consecutive days, the lead is split (another team, another domain architect) rather than told to hurry.

*Forbids:* one lead for more than five engineers; one architect for more than three teams; a "central dispatcher" role.
*Evidence:* the pilot's lead sent or received about half of all traffic and relayed much of it; the queue in front of that role set the delivery pace (*Evidence §3*).

## P11. Idle agents cost

Resident roles (those with a continuous stream of work during a sprint) stay up; on-demand roles start when their inbox has an item and stop after a quiet interval. The board shows which inboxes have unread items with no live session, so a person (v1, v2) or the supervisor (v3) can start the role.

*Forbids:* keeping every role's session open all day; an on-demand role's inbox waiting for hours because no session is running and nobody noticed.
*Evidence:* several pilot sessions sat idle for days while others were starved of memory on the same machine (*Evidence §8*).

## P12. Measure the process from its own artefacts

`maa metrics` computes response latency per role pair, the share of protocol overhead, hub share and service-level breaches from the message files. `maa board` computes liveness from status files and inbox ages. The delivery lead reviews these weekly and changes staffing or routes, not exhortations.

*Forbids:* process changes without a number; status reports that cannot be reproduced from the files.
*Evidence:* every number in `00-distillation/02-evidence-from-remitly.md` was recovered from the pilot's files after the fact; the pilot itself never looked at them while running.

## P13. Pull before ask

Each team publishes a module card (purpose, owners, repositories, contracts provided and consumed with versions, how to run it, known limits, frequently asked questions). Another team reads the card, the contract and the docs first; only what those do not answer becomes a `REQUEST` to the team's lead.

*Forbids:* engineer-to-engineer questions across teams; a question whose answer is in the module card.
*ASSUMPTION:* the pilot had one team, so cross-team traffic was never measured. The rule follows from P10: cross-team questions must not become another hub.
