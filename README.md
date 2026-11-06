# multi-agent-architecture

An operating model for software delivery by teams of AI agents (Claude Code sessions today; a supervised fleet later), distilled from a four-week pilot in which eight hand-started agents shipped a B2B product on one shared laptop, and redesigned so the same roles, messages and gates scale to several teams, several repositories and several machines.

**Status:** v0.1, 2026-11-07. Design and tooling are complete for the single-team variant (v1); the multi-team hand-started variant (v2) is designed and ready to run on 1–3 laptops; the programmatic variant (v3) is designed only and waits for compute.

## Why this exists

The pilot (see `00-distillation/`) proved that strict roles, written briefs, append-only logs and one-verdict-per-task let agents build real software with little human attention. It also showed four limits, all measured in `00-distillation/02-evidence-from-remitly.md`:

1. every message went through one lead agent (a star), so that agent's queue, not the work, set the pace;
2. agents found messages by polling a folder on a timer, so each hop cost 5–30 minutes;
3. a third of all traffic was protocol overhead (acknowledgements, resends, status) because nothing enforced the message format;
4. one laptop and hand-started terminals put a hard ceiling on how many agents could run, and nobody supervised which ones were alive.

This repository keeps what worked and fixes what did not, in a form that is **not tied to any product**.

## Layout

| Folder | What it holds | Read it when |
|---|---|---|
| `00-distillation/` | The pilot as built, the measured evidence, and scrubbed copies of its original artefacts | You want to know where the rules come from |
| `core/` | The operating model every variant shares: principles, organisation (four chains), roles, messaging protocol, work lifecycle and gates, repositories and contracts, scaling, templates | You are setting up or changing any variant |
| `variants/v1-single-team-one-laptop/` | One team, one repository, hand-started sessions on one machine | You are starting a product today with the compute you have |
| `variants/v2-multi-team-hand-started/` | Up to 3 teams, several repositories, 10–15 sessions on 1–3 machines, a human runs the scaling playbook | You have more than one module and a second machine |
| `variants/v3-multi-team-programmatic/` | A supervisor process starts, feeds, scales and retires agents on the same protocol | You have spare compute and want the playbook to run itself |
| `tooling/maa/` | `maa`, a dependency-free Node 22 command-line tool that implements the mailbox (send, inbox, open, done, thread, board, status, validate, metrics, watch) | Every agent uses it; every variant ships it |

Read in this order the first time: `core/00-principles.md` → `core/01-organisation.md` → `core/03-messaging.md` → the variant you intend to run.

## Choosing a variant

| Question | v1 | v2 | v3 |
|---|---|---|---|
| How many modules (teams)? | 1 | 2–3 | 2 or more |
| Who starts and stops agents? | a person | a person, following `core/06-scaling.md` | a supervisor process |
| Machines | 1 | 1–3 | any (local or hosted) |
| Mailbox transport | local folder + session ping | git-backed folder shared by the machines | queue behind an API |
| Concurrent agents | 4–8 | 10–15 | budget-limited |

All three use the **same** message format, role prompts, board layout and gates, so a product can start on v1 and move to v2 or v3 without rewriting its history.

## Naming used throughout

- Roles are written `<ROLE>-<TEAM>[-<n>]`: `TL-BILLING`, `SE-BILLING-2`, `PM-BILLING`, `QA-BILLING`. Cross-team heads have no team suffix: `HOP`, `CA`, `DL`, `HOQ`. The human owner is `FOUNDER`.
- Identifiers always carry their scope: `WP-BILLING-3`, `T-BILLING-3.2`, `FR-BILLING-4.1`, `DEC-ORG-0012`, `BUG-BILLING-0007`, `CR-BILLING-0031`, `ADR-ORG-004`.
- "The board" is a team's `PROGRESS.md`; "the programme board" is the cross-team `PROGRAM.md`; "the mailbox" is the `comms/` tree that `maa` manages.

## Conventions for this repository

Plain English, British spelling, one recommendation per decision, every rule traceable to evidence in `00-distillation/` or to a stated assumption. No product names, people's names, e-mail addresses or secrets outside `00-distillation/` (which names the pilot). See `CLAUDE.md`.
