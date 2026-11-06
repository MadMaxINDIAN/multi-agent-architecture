# Organisation: four chains, teams and decision rights

**Summary.** Work is organised in **teams**, each owning one **module** (one or more repositories). Four **chains** run across the teams: Product, Architecture, Delivery and Quality. Each chain has a **head** who reports to the founder and manages the workload of the chain's per-team roles; each per-team role serves one team. No role has more than five direct reports (P10). Who may message whom is a short, enforced list (§5); the mailbox tool rejects anything else.

## 1. The four chains

```
FOUNDER (human)
├── Product       HOP ──── PM-<TEAM>        (one per team)
├── Architecture  CA  ──── DA-<DOMAIN>      (one per domain = 1–3 teams)
├── Delivery      DL  ──── TL-<TEAM> ─┬── SE-<TEAM>-n   (1–4 per team)
│                                      └── CR-<TEAM>     (or one CR shared by ≤3 teams)
└── Quality       HOQ ─── QA-<TEAM> ──── QA-<TEAM>-n   (0–2 per team)
```

| Chain | Head (cross-team) | Per team | Members | Owns |
|---|---|---|---|---|
| Product | `HOP` Head of Product | `PM-<TEAM>` Product Manager | — | What is built and in what order; requirements (`FR-<MOD>-x.y`); acceptance criteria; the founder's proxy for scope questions inside the approved roadmap |
| Architecture | `CA` Chief Architect | `DA-<DOMAIN>` Domain Architect | — | How modules fit together: the module map, contracts between modules (`05-repos-and-contracts.md`), cross-module ADRs (`ADR-ORG-nnn`), module HLD/LLD, conformance review |
| Delivery | `DL` Delivery Lead | `TL-<TEAM>` Team Lead | `SE-<TEAM>-n` Senior Engineer, `CR-<TEAM>` Code Reviewer | Building it: plans, briefs, verdicts, merges, boards, staffing and scaling within budget, liveness |
| Quality | `HOQ` Head of Quality | `QA-<TEAM>` QA Lead | `QA-<TEAM>-n` QA Engineer | Proving it works: test plans, independent verification, defects (`BUG-<TEAM>-nnnn`), traceability, release sign-off |

The pilot had two chains (design and delivery) with the founder acting as product owner and QA reporting to the delivery lead. The Product and Quality chains are new; they exist so that scope answers and quality verdicts do not queue behind the founder or the team lead (*Evidence §3, §6*).

## 2. Teams, modules, domains

| Term | Definition | Limits |
|---|---|---|
| **Module** | A bounded part of the product with its own repository (or repositories), its own PRD section, its own contracts with other modules and one owning team | A module is owned by exactly one team |
| **Team** | The set of roles that build, verify and specify one module: `TL`, 1–4 `SE`, a `CR` (own or shared), a `PM`, a `QA` lead (and optionally QA engineers), served by one `DA` | ≤ 5 direct reports per `TL` (P10); one module per team |
| **Domain** | The modules whose contracts one `DA` owns, grouped by how tightly they interact | ≤ 3 teams per `DA`; ≤ 4 `DA`s per `CA` |
| **Programme** | All teams under one founder | 3 teams at 10–15 concurrent agents is the design point (`06-scaling.md`) |

A team's **front desk** is its `TL`: the one address other teams use. Everything a team wants others to know without asking is in its **module card** (`templates/module-card.md`, P13).

## 3. Role catalogue

| Role id | Chain | Level | Reports to | Residency | What it does (one line) |
|---|---|---|---|---|---|
| `FOUNDER` | — | 0 | — | human | Approves scope, roadmap, budget, releases and irreversible actions; answers what heads escalate |
| `HOP` | Product | 1 | `FOUNDER` | on-demand | Roadmap across teams; priority between teams; decides scope questions inside the roadmap; manages PMs' workload |
| `PM-<TEAM>` | Product | 2 | `HOP` | on-demand; resident during planning | Writes and maintains the module PRD (`FR-<MOD>-x.y`, business rules, acceptance criteria); orders the team backlog; answers requirement questions |
| `CA` | Architecture | 1 | `FOUNDER` | on-demand | Module map; assigns modules to domains and DAs; balances DA load; approves cross-domain contracts and `ADR-ORG`; arbitrates contract disputes |
| `DA-<DOMAIN>` | Architecture | 2 | `CA` | on-demand | Contracts, HLD/LLD and ADRs for its modules; build briefs per work package; conformance review before a work package is DONE |
| `DL` | Delivery | 1 | `FOUNDER` | resident while any sprint runs | Programme plan and board; staffing and scaling within the agent budget; liveness; cross-team scheduling; release coordination with `HOQ` |
| `TL-<TEAM>` | Delivery | 2 | `DL` | resident | Team plan and board; splits work packages into tasks; briefs; runs the tests before any verdict; issues the one verdict per task; merges; the team's front desk |
| `SE-<TEAM>-n` | Delivery | 3 | `TL-<TEAM>` | resident during a sprint; scaled | Implements one bounded task at a time with tests; reports with evidence |
| `CR-<TEAM>` (or `CR`) | Delivery | 3 | `TL-<TEAM>` (`DL` if shared) | on-demand | Reads changed code one unit at a time; keeps the code map; findings `CR-<TEAM>-nnnn`; review verdict before the TL verdict |
| `HOQ` | Quality | 1 | `FOUNDER` | on-demand | Quality bar; release sign-off with `DL`; cross-module regression and end-to-end suites; manages QA leads' workload |
| `QA-<TEAM>` | Quality | 2 | `HOQ` | resident during verification | Test plan per work package; independent verification; defects; traceability; QA verdict |
| `QA-<TEAM>-n` | Quality | 3 | `QA-<TEAM>` | scaled | Runs assigned test plans and exploratory sessions; reports defects |

Residency terms are defined in `06-scaling.md §2`: a **resident** role keeps a session up for the whole sprint; an **on-demand** role's session is started when its inbox has an item and stopped after a quiet interval; a **scaled** role is added and removed by the scaling rules.

Full role prompts: `core/roles/<ROLE>.md`.

## 4. Decision rights

One role decides each kind of question; everyone else can propose. A decision is recorded as a `DECISION` message **and** a row in the decision log (`04-work-and-gates.md §6`).

| Question | Decides | Must consult | Escalates to |
|---|---|---|---|
| Roadmap, phase scope, agent budget, first release, anything irreversible | `FOUNDER` | heads | — |
| Priority between teams; scope questions inside the approved roadmap | `HOP` | `DL`, `CA` | `FOUNDER` when the roadmap would change |
| Requirements of a module (`FR`), acceptance criteria, backlog order within the team | `PM-<TEAM>` | `TL`, `QA-<TEAM>` | `HOP` when another team is affected |
| Module map; which team owns a module; `ADR-ORG`; cross-domain contract changes; contract disputes | `CA` | `DA`s, `DL` | `FOUNDER` for cost or scope |
| Contracts within a domain; module HLD/LLD; module ADRs; conformance | `DA-<DOMAIN>` | both `TL`s of a contract | `CA` when more than one domain is involved or the TLs disagree |
| Staffing and scaling inside the budget; which team gets a shared `CR`; stack and machine allocation | `DL` | `TL`s | `FOUNDER` beyond budget |
| Task split, briefs, verdicts, merges to the module repository | `TL-<TEAM>` | `CR`, `QA-<TEAM>` | `DL` for cross-team conflicts; `DA` for design gaps |
| Implementation inside the files a task owns | `SE-<TEAM>-n` | — | `TL` when the brief is unclear or too big |
| Severity of a defect or finding | `QA-<TEAM>` / `CR` | — | `HOQ` / `TL` if disputed |
| Whether a defect is fixed now or deferred | `TL-<TEAM>` | `QA-<TEAM>`, `PM` | `HOQ` if S1/S2 is deferred |
| Quality bar; release readiness; cross-module regression scope | `HOQ` | `DL`, `QA` leads | `FOUNDER` for a release with open S1/S2 |

## 5. Who may message whom

The mailbox tool checks every `maa send` against these rules (`03-messaging.md §7`) and refuses the rest.

| Rule | Allowed route | Purpose |
|---|---|---|
| R1 Vertical | any role ↔ its manager; any role ↔ its direct reports | tasks, reports, verdicts, questions, escalation |
| R2 Team table | within one team: `TL` ↔ `PM`, `TL` ↔ `QA` lead, `TL` ↔ `DA` (of the team's domain), `TL` ↔ `CR` | planning, verification requests, design questions, review requests |
| R3 Thread-scoped | within one team: `SE` ↔ `QA` lead or `QA` engineer, `SE` ↔ `CR`, **only** on a message whose `thread` is a task the `SE` currently owns | defect reproduction, finding clarification, re-test requests. The `TL` reads the thread (`maa thread`), nothing is relayed |
| R4 Peers | `HOP` ↔ `CA` ↔ `DL` ↔ `HOQ` (the steering group); `TL` ↔ `TL`; `DA` ↔ `DA`; `PM` ↔ `PM`; `QA` lead ↔ `QA` lead | cross-team information and alignment. A `TL` → `TL` message may ask for **information** about a module, never for work |
| R5 Founder | `FOUNDER` ↔ heads | decisions, reports, escalations |
| R6 P0 exception | a `P0 BLOCKER` may go one level above the normal route (`SE` → `DL`, `TL` → `FOUNDER`, `QA` lead → `FOUNDER`) when the normal recipient is stale by the liveness rule | nobody waits on a dead session |

Forbidden, and the reason:

- `SE` → anyone in another team (would recreate engineer-to-engineer coupling across module boundaries; P13).
- `SE` → `DA`, `PM`, `HOP`, `CA`, `FOUNDER` (design and scope questions go through the `TL`, who may already know the answer and keeps the thread; pilot rule that held).
- Anyone → `FOUNDER` except heads (P9; the founder's queue is the scarcest resource, *Evidence §6*).
- Work requests across teams in any direction other than `HOP`/`DL` → the receiving chain (cross-team work is a planning decision, not a favour).

## 6. One session, several roles (multiplexing)

Fifteen concurrent sessions cannot host twenty-plus roles, and most head and architect roles have bursty work. One session may hold more than one role when **all** of these hold:

1. the roles are in the **same chain** and at **adjacent levels** (`HOP`+`PM-*`, `CA`+`DA-*`, `DL`+`TL-<one team>`, `HOQ`+`QA-<team>`, `QA-<team>`+`QA-<team>-n`);
2. the session keeps **one inbox per role**, checks each, and signs every message with the role it is acting as;
3. the combination is listed on the programme board (`PROGRAM.md §1`) so everyone knows who is answering as what.

Never in one session:

| Combination | Why |
|---|---|
| `SE` with `TL`, `CR` or `QA` of the same team | author and verifier (P6) |
| `DA` with `SE` | designs and builds its own contract; conformance review becomes self-review |
| `PM` with `SE` | writes the requirement and the code that claims to meet it |
| two `TL`s | one session becomes the hub the design removes (P10) |
| two `SE`s whose tasks share a file | P7 |
| `FOUNDER` duties delegated to any agent | P9 |

At the lowest load (v1) this collapses to the pilot's shape: `ARCH` = `CA`+`DA`, `LEAD` = `DL`+`TL`, `QA` = `HOQ`+`QA` lead(+engineer), the founder acting as `HOP`+`PM`. The role prompts are the same; only the combination differs.

## 7. Reference configurations

Counts are **concurrent sessions**; on-demand roles count only while running.

| Configuration | Resident sessions | On-demand sessions (typical) | Total at peak |
|---|---|---|---|
| **v1, one team** | `LEAD` (DL+TL), 1–4 `SE`, `QA` (HOQ+QA lead) | `ARCH` (CA+DA), `CR` | 4–8 |
| **v2, three teams, lean** | 3 `TL`, 3 `SE` (one per team), 1 shared `CR`, 1 `QA` engineer shared and directed by `HOQ` | `HOP`(+PMs), `CA`(+DAs), `DL`, `HOQ`(+QA leads) | 8 resident + up to 4 = 12 |
| **v2, three teams, full** | 3 `TL`, 6 `SE` (two per team), 1 shared `CR`, 2 `QA` (one lead covering two teams, one engineer) | `HOP`, `CA`, `DL`, `HOQ` | 12 resident + up to 4 = 16 → cap at 15 by keeping one head off at a time |
| **v3** | decided by the scaling rules inside the budget | — | budget |

The 15-session cap is a budget, not a target. With one team's sprint idle, its `TL` and `SE`s stop and the sessions go to another team (`06-scaling.md`).

## 8. When to add a level or split a role

| Signal (from `maa board` / `maa metrics`, measured over two consecutive working days) | Action | Decided by |
|---|---|---|
| A `TL`'s verdict queue age > 2 × its P1 service level | add an `SE`-free day for verdicts, then split the team or add a sub-lead | `DL` |
| A `DA` serves > 3 teams, or its contract-request queue age > service level | add a `DA`, move a team | `CA` |
| `CA` arbitrates more than two contract disputes a week | the domain boundaries are wrong; redraw them | `CA` with `FOUNDER` |
| `HOP`'s scope-question queue age > service level | add a `PM` to the team generating the questions | `HOP` |
| `FOUNDER` queue holds items older than two days | the heads are escalating what they may decide; `DL` reviews decision rights with the founder | `FOUNDER` |
| a shared `CR` or `QA` engineer breaches service level for two teams | give the busiest team its own | `DL` / `HOQ` |

Span-of-control limits (≤ 5 reports per lead; ≤ 3 teams per `DA`; ≤ 4 `DA`s per `CA`) are hard; the signals above are the early warning.
