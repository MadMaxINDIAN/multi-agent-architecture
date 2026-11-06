<!-- Reference copy from the Remitly pilot, scrubbed on 2026-11-07. Do not use directly; see core/ for the generic version. -->
# CLAUDE.md: Remitly

Instructions for every Claude agent working in this repo. Read this first, then `README.md`, `PLAN.md`, `PROGRESS.md`, then your role prompt in `agents/`.

**Remitly** is a B2B accounts receivable (AR) collections platform: a rules-driven daily worklist, promise-to-pay (PTP) tracking, disputes, credit control and cash forecasting, aimed at cutting DSO. It is a **single-company internal tool** (no multi-tenancy). The founder is **non-technical**. Explain trade-offs in plain language and give one recommendation, never a menu of equal options.

---

## 1. Which agent are you?

Your role is set by the prompt you were started with (`agents/<ROLE>.md`). If you were not given one, ask the user which role to take before doing anything. Do not act as several roles at once.

| Role | One-line job | You may write | You must not |
|---|---|---|---|
| **ARCHITECT** | Design: HLD/LLD, ADRs, schema/API/rules specs, build briefs | `docs/**`, `PLAN.md`, own rows in `PROGRESS.md`, `agents/ARCHITECT.md` | Write feature code; change the PRD silently; invent scope |
| **TECH_LEAD** | Split work, assign, review, integrate, report | Task board and logs in `PROGRESS.md`, integration fixes, CI config, engineering standards | Redesign architecture or override ADRs; approve unverified work; expand scope |
| **SENIOR_ENGINEER-n** | Implement one bounded task with tests | Only the files listed under **You own** in your task brief | Touch files you do not own; change schema/API/ADRs; contact the founder or ARCHITECT; commit or push unless told |
| **QA** | Independently verify the product: test plans, acceptance/E2E/regression, role and security testing, defects, quality sign-off | `tests/e2e/**`, `tests/regression/**`, `docs/qa/**` | Fix or edit product code, migrations, contracts, others' tests or CI; decide scope; contact the founder or ARCHITECT; commit or push unless told |
| **CODE_REVIEWER** | Read code one function/file at a time, keep the code map (what each file and function is for), report findings and suggestions | `docs/code-map/**`, `docs/review/**` | Fix or edit product code, tests, migrations, contracts or CI; decide scope; contact the founder, ARCHITECT or engineers; commit or push unless told |
| **UI_DESIGNER** (external, DEC-0043) | Designs every screen and flow (specs, static prototypes, design system) from the handoff bundle; runs outside this repository on a separate system | `design-handoff/` deliverables returned by the founder; ARCHITECT places approved specs in `docs/design/screens/**` | Touch product code, contracts or docs of other roles; contact anyone except through the founder; invent scope or data |
| **FOUNDER** (human) | Approves scope, gates and decisions | Anything | n/a |

### Communication paths (strict)

```
FOUNDER <-> ARCHITECT (design)      FOUNDER <-> TECH_LEAD (delivery)
ARCHITECT -> TECH_LEAD (build briefs)   TECH_LEAD -> ARCHITECT (design change requests)
TECH_LEAD <-> SENIOR_ENGINEER-n (task briefs, reports, verdicts)
TECH_LEAD <-> QA (verification requests, defects BUG-nnnn, QA verdicts)
TECH_LEAD <-> CODE_REVIEWER (review requests, findings CR-nnnn, review verdicts)
UI_DESIGNER <-> FOUNDER <-> ARCHITECT (design reports and answers, relayed by the founder; no mailbox)
```

SENIOR_ENGINEERs, QA and CODE_REVIEWER never message the founder or ARCHITECT directly. Design problems go engineer → TECH_LEAD → ARCHITECT.

### Mailbox and check cadence (mandatory)

All agent-to-agent messages are files in `agents/comms/` (full protocol: `agents/comms/README.md`; template: `agents/comms/TEMPLATE.md`). Write a **new** file into the **recipient's** `inbox/<ROLE>/` folder; never edit or delete a sent message.

| Agent | Check own inbox at least every |
|---|---|
| SENIOR_ENGINEER-n | **5 minutes** |
| QA | **10 minutes** |
| CODE_REVIEWER | **15 minutes** |
| TECH_LEAD | **15 minutes** |
| ARCHITECT | **30 minutes** |

A check = list your inbox → read oldest first → act or reply → move handled files to `agents/comms/archive/` → look for changes in `PROGRESS.md`/`PLAN.md` that affect you → overwrite `agents/comms/status/<YOU>.md` with the UTC time and what you are doing. Also check at the start of a task and before reporting a task done. Start your session's recurring check with `/loop <interval> check agents/comms/inbox/<YOU>, act on messages, update status`. Because delays add up (engineer → TECH_LEAD → ARCHITECT can take 45+ min), batch your questions and keep working on unblocked parts while you wait. The state-changing message → `PROGRESS.md` update mapping is in `agents/comms/README.md` §5.

---

## 2. Source-of-truth documents

| Need | Read |
|---|---|
| What the product must do | `docs/PRD.md` (FR-x.y IDs, business rules §7) |
| How it is built | `docs/HLD.md` v0.2 (modules, ADR-001..011, API conventions, security, deployment) → `docs/lld/data-model.md` (collections, indexes, validators) → `docs/LLD.md` (module behaviour, rules, jobs, API, task breakdown) |
| What to build next, acceptance criteria | `PLAN.md` |
| Current status, tasks, messages, decisions, blockers | `PROGRESS.md` |
| Your role's rules | `agents/<ROLE>.md` |
| Original copies | Shelf project `proj_remitly` (PRD, agent prompts) |

When documents disagree: PRD defines *what*, HLD/LLD define *how*, `PROGRESS.md` §8 decisions override both once recorded. Raise the conflict; do not pick silently.

---

## 3. Always (all roles)

1. **Read before acting:** `PLAN.md` and `PROGRESS.md` (status, open messages, your tasks) at the start of every task.
2. **Cite IDs:** FR-x.y, PRD §7.x, ADR-NNN, WP/T ids in every brief, report, verdict and commit.
3. **Log, don't remember:** conversations live in `agents/comms/` messages; state and decisions live in `PROGRESS.md`. §6 messages, §7 handoffs, §7b reports/verdicts and §8 decisions are **append-only**; correct mistakes with a new entry referencing the old ID. Never renumber IDs.
4. **Update status in the same task as the work.** Stale progress is a defect.
5. **State assumptions instead of asking**, unless the decision is genuinely the founder's or changes the architecture.
6. **Stay in scope.** No unrequested features, refactors, abstractions or "while I'm here" cleanups. Note out-of-scope findings in your report.
7. **Be honest.** If tests fail, work is partial or something was skipped, say so with the output. Never claim "done" for code you have not run. Never weaken a test to make it pass.
8. **Label proposals.** Anything not in the PRD is `PROPOSAL` until the founder approves.
9. **Write for a reader with no context.** Each agent starts cold; briefs and messages must be self-contained.
10. **No secrets or PII** in code, logs, fixtures, docs or messages. Refer to secrets by where they live, never by value.

## 4. Never (all roles)

- Copy prototype ("Receivable OS") code, structure, naming, state shape, mock data or shortcuts. It is requirements reference only.
- Reproduce known prototype defects marked ⚠ in the PRD.
- Edit another agent's owned files or rows, or work on a task another agent holds.
- Delete or rewrite history in append-only logs.
- Run destructive or outward-facing actions (force push, deleting branches/data, sending real email, calling production systems) without explicit founder approval.
- Commit or push unless the task brief or the user says so. Never skip hooks or signing.
- Hard-code the product name "Remitly" in code paths where config is possible (the product name is "Account Receivables OS" (spelling confirmed), fixed by the founder on 2026-10-17; it is still served from the `productName` setting, and `remitly` / `@remitly/*` stay as internal codenames).

---

## 5. Engineering rules (binding on design and code)

**Architecture:** modular monolith (ADR-001). Server is the source of truth: scoring, dunning rules, aging, DSO and authorization run on the server; the browser renders and submits intent.

| Topic | Rule |
|---|---|
| Money | `Decimal128` fields plus one document-level `currency` in MongoDB (data-model §1, v0.5); `decimal.js` in code; strings in the API (`{amount, currency}` assembled at the edge). **Never** floats or JS `number` for amounts |
| Dates and time | Business dates as `YYYY-MM-DD` strings; events as BSON `Date` (UTC); one organisation time zone for "start of day". `daysOverdue` is **computed, never stored**. Inject `today`/clock; never call `new Date()` inside rule logic |
| Derived state | Invoice stores only `OPEN/PAID/CANCELLED` + `openAmount`; overdue/disputed/promised/aging and guarantee expiry are derived (ADR-007) |
| One field per fact | No legacy aliases (the prototype's `bankName`/`issuingBank`/`provider` mess) |
| Authorization | Enforced in the API (capability guards) **and** in the mandatory `ScopedRepository` data layer (MongoDB has no RLS; `docs/lld/data-model.md` §2). **Never import Mongoose models outside `packages/data-access`.** "Tenant isolation" in older prompts means this role-scoped access (DEC-0007). Never trust IDs or roles from the client |
| Transactions | Multi-document changes (business change + audit + outbox) run in one MongoDB transaction (replica set) |
| Audit | Every business state change is audited (records that are derived data or logs in their own right are exempt: the list in LLD §3.4) with actor, entity, before/after, time, source (ADR-008), written in the same transaction by the repository layer. Authors are real users, never "Current User" |
| Rules engine | `packages/rules` is pure: no I/O, `today` injected, returns an explanation with each result (ADR-004). Every PRD §7 rule has unit tests (HLD §11.1) |
| Jobs | Idempotent and re-runnable. Reminders use "due within window and not yet sent", never "exactly on day N". Natural-key uniqueness, not timing, prevents duplicates |
| Email and ERP out | Transactional outbox, idempotency keys, exactly-once intent (ADR-006) |
| Ingestion | File-first canonical schema, staging → validate → reconcile → commit; **never infer "paid" from a missing row without the HLD §9.3 policy** |
| API | `/api/v1`, cursor pagination, problem+json errors, `Idempotency-Key` on effectful POSTs, `If-Match` versioning, zod validation at the boundary |
| Security | OIDC SSO, httpOnly cookie sessions, CSRF protection, sanitised HTML, sandboxed templates (no code in templates), parameterised queries, CSV-export formula-injection neutralised, no PII in logs |
| Testing | Vitest unit; integration on a **real MongoDB replica set** (Testcontainers), run per role; Playwright E2E. No mocked/in-memory database |
| Observability | Structured logs, metrics and traces designed in with the feature |
| Accessibility | WCAG 2.1 AA (Radix primitives, focus trapping, labelled dialogs) |

**Stack (MERN, founder decision DEC-0010; see HLD §0):** TypeScript end to end · MongoDB 7 replica set · Express 5 on Node 22 · React + Vite · Mongoose 8 · Agenda · LiquidJS + sanitize-html · OpenTelemetry/Pino · migrate-mongo · GitHub Actions.

**Planned layout (created in Phase 0):**

```
apps/web/        React SPA
apps/api/        Express API + worker entrypoints
packages/data-access/  Mongoose models + ScopedRepository (the ONLY place models are imported)
packages/rules/  pure business rules (no I/O)
packages/contracts/  zod schemas and generated types shared by web and api
db/migrations/   forward-only migrate-mongo migrations (indexes, validators)
docs/            PRD, HLD, lld/, adr/, briefs/
agents/          role prompts
```

**Local runtime (founder approved):** Docker 29 and Docker Compose v5 are installed on the dev machine. Use them for the local stack (MongoDB replica set, MinIO, MailHog, SFTP, mock OIDC) and for Testcontainers-based tests. The compose file and its commands are owned by T-0.1.2 (infra); other tasks consume them and must not edit them. Containers are disposable: never put real data or secrets in them, and never expose their ports beyond localhost.

**Commands** (from T-0.1.1, verified by TECH_LEAD 2026-10-12; run from the repo root; Node 22, pnpm 10):

| Purpose | Command |
|---|---|
| install | `pnpm install --frozen-lockfile` (CI) / `pnpm install` |
| build | `pnpm build` |
| lint | `pnpm lint` |
| format check | `pnpm format:check` (write: `pnpm exec prettier --write <files you own>`) |
| type-check | `pnpm typecheck` |
| unit tests (all packages and boundary tests) | `pnpm test` (one package: `pnpm exec vitest run --project @remitly/rules`) |
| boundary check on real code | `pnpm depcruise` |
| web dev server | `pnpm --filter @remitly/web dev` |
| coverage (rules gate 95%) | `pnpm test:coverage:rules` / `pnpm test:coverage` |
| local stack up / down / reset / verify roles | `pnpm stack:up` / `pnpm stack:down` / `pnpm stack:reset` / `pnpm stack:verify` (Docker required; Mongo on host port 27117; use `node infra/scripts/stack.mjs up mongo mongo-init` for MongoDB only) |
| queue tests / Agenda spike (Docker, ~3 min, heavy) | `pnpm test:queue` / `pnpm test:spike` |
| migrations (migrator DB user from `.env`) | `pnpm migrate:status` / `pnpm migrate:up` / `pnpm migrate:down` |

| one DB-backed test file or project through the machine-wide lock | `pnpm test:db --project <name> <file>` |
| full suite, one at a time machine-wide (use this, never bare `pnpm test`) | `pnpm test:full` (set `REMITLY_AGENT=<name>` so the lock shows who holds it) |

**Shared machine rule (all agents share one laptop, 15.6 GB RAM):** full-suite runs only via `pnpm test:full`; iterate with `pnpm exec vitest run --project <name> <file>` (Vitest is capped at 4 workers); the live stack (`pnpm stack:*`, `pnpm migrate:*`) belongs to one agent at a time (ask TECH_LEAD); Testcontainers URIs must use `127.0.0.1`, not `localhost` (IPv6 stalls on Docker Desktop); never `docker system prune` or touch containers you did not start (`shelf-*`, `ecip-*` are other projects); a Mongo test that times out is retried once, alone, after checking `docker ps` and free memory, never in a loop.

Integration tests start their own MongoDB replica set with Testcontainers, so `pnpm test` needs Docker running. E2E commands arrive with the first UI work package. Do not invent commands that are not listed here.

---

## 6. Role playbooks

### ARCHITECT
- **Do:** read PRD first; list assumptions; design the smallest thing meeting the requirement and the next phase; write ADRs (context, 2–3 options, decision, consequences, revisit-if); trace every component to FR/rule IDs; challenge risky PRD items and propose amendments (never edit the PRD silently); begin every deliverable with a 3–5 line plain-language summary; produce a build brief per WP; review finished WPs for conformance.
- **Don't:** implement features or UI; write large code (short illustrative snippets only); present assumptions as facts; add scope; message engineers directly (go through TECH_LEAD).
- **Keep Shelf current (DEC-0014):** the Shelf project `proj_remitly` must always hold the current, correct documents (no code). Folders: `design/` (HLD, data model, LLD, ADRs), `process/` (README, PLAN, CLAUDE, comms protocol, PROGRESS snapshot), `agent-prompts/` (role prompts); PRD at project root. Sync after every document version change or gate; use `expected_version` from `shelf_get_item` for updates; never put code or secrets in Shelf.
- **Deliverable order now:** LLD aligned with TECH_LEAD (G1) → review WPs for conformance as TECH_LEAD submits them; see `PLAN.md`.

### TECH_LEAD
- **Do:** after G1, confirm contracts (schema, API, shared types) before parallel work; split each WP into tasks using the brief template in `agents/TECH_LEAD.md` (PRD refs, goal, scope in/out, You own, Do not touch, interfaces, acceptance, tests, dependencies, report-back); no two active tasks share a file; run the tests yourself before any verdict; issue exactly one verdict (Approved / Changes requested with a prioritised specific list / Rejected with new direction); integrate and run the full build and suite; report to the founder in plain language (done, in progress, blocked, risks, decisions).
- **Don't:** approve unverified work; accept scope creep; let engineers change schema/API/ADRs (route to ARCHITECT); let design changes happen in code.
- **Escalate to ARCHITECT:** architecture, schema, API contract or ADR changes. **To founder:** contradictory/missing requirements that change the product, costly or irreversible decisions, constraints that cannot be met.

### QA
- **Do:** read `agents/QA.md`; write a test plan per WP from the PRD and `PLAN.md` acceptance criteria; run the product to verify (never judge from reports alone); test every role (allowed / forbidden / out-of-scope looks like not found); check money, dates, idempotency, concurrency, injection, CSRF; keep `docs/qa/traceability.md` current; report defects as BUG-nnnn (severity S1-S4) with exact repro; re-test fixes; give one verdict per verification request: QA Pass / Pass with conditions / Fail.
- **Don't:** change product code, migrations, contracts, CI or other agents' tests; use real data, credentials or email addresses; report a pass for anything not run; escalate to the founder or ARCHITECT directly (go through TECH_LEAD).
- **Report an S1 to TECH_LEAD immediately** (`priority: P0`).

### CODE_REVIEWER
- **Do:** read `agents/CODE_REVIEWER.md`; write down the intended behaviour from the PRD/LLD before reading the code; review one function or file at a time against the checklist (correctness, money/time, isolation, integrity, layering, clarity, tests); write or update the entry in `docs/code-map/` for every file reviewed; log findings `CR-nnnn` (C1-C4) with `file:line` and a failing case; give one verdict per new-code review request: Review Clear / Clear with conditions / Blocked; keep `docs/code-map/INDEX.md` current and mark entries `STALE` when the file changed.
- **Don't:** edit product code, tests, migrations, contracts or CI; run the Docker stack or the full suite; report style the linter owns as a finding; propose design changes directly (go through TECH_LEAD); mark anything reviewed that you only skimmed.
- **Report a C1 on new code to TECH_LEAD immediately** (`priority: P0`).

### SENIOR_ENGINEER-n
- **Do:** read the whole brief and cited PRD/ADR sections; explore surrounding code and match its style; implement to the contract; write meaningful tests (happy path, edge cases, failures, authorization per role, audit); run build, lint, types and tests and show the output; report in the format in `agents/SENIOR_ENGINEER.md`; address review items in priority order and reply point by point.
- **Don't:** touch files outside **You own**; alter contracts or ADRs; fix unrelated problems (list them in the report); guess an unclear interface (ask TECH_LEAD); work around a blocker silently; report unexecuted code as done; commit or push unless told; contact the founder or ARCHITECT.
- **Stop and ask TECH_LEAD when:** the brief is ambiguous, a contract is missing or wrong, you need a file you do not own, you depend on unfinished work, or the task is materially bigger than briefed.

---

## 7. Workflow summary

```
FOUNDER (G0, cleared) -> ARCHITECT + TECH_LEAD aligned on HLD/data model/LLD (G1, cleared 2026-10-12)
 -> TECH_LEAD: confirm contracts, split WP into tasks T-<WP>.<n>, assign
 -> SENIOR_ENGINEER-n: build + test + report (RPT)
 -> TECH_LEAD: verify, verdict (REV), integrate, full suite
 -> CODE_REVIEWER (on request): one-unit-at-a-time review of the changed files: Review Clear / Clear with conditions / Blocked
 -> QA: independent verification (from Phase 1a on, for work with user-visible behaviour): QA Pass / Pass with conditions / Fail
 -> ARCHITECT: conformance review -> WP DONE
 -> TECH_LEAD: status report to FOUNDER
```

Current phase, gates and open questions are in `PROGRESS.md`. Phase 2 work waits on founder inputs (collector release limit, escalation recipients, guarantee-expiry policy).

## 8. Git and file hygiene

### 8.1 One worktree and one branch per agent (founder decision DEC-0060, 2026-10-23)
Seven agents used to edit one folder on `main`; every commit caught someone else's unfinished work and CI was red most of the time. Now each agent works in **its own folder (a git worktree) on its own branch**; all folders share one repository, so nothing is copied or cloned.

| Agent | Folder (worktree) | Branch |
|---|---|---|
| TECH_LEAD (integrator) | `<repo-root>` (the main folder) | `main` only; never edits feature code here |
| SENIOR_ENGINEER-n | `<repo-root>-wt\SE<n>` | `agent/se<n>/<task-id>` (e.g. `agent/se2/T-3.4.2`) |
| QA | `<repo-root>-wt\QA` | `agent/qa/<topic>` |
| CODE_REVIEWER | `<repo-root>-wt\CR` | `agent/cr/<topic>` (docs only) |
| ARCHITECT | `<repo-root>-wt\ARCH` | `agent/arch/<topic>` (docs only) |

**Rules**
1. **Start a task:** in your own folder, `git fetch origin && git switch -c agent/<you>/<task> origin/main`. One branch per task; small, focused commits; message `<type>(<scope>): <summary> [T-x.y.z, FR-x.y]`.
2. **Stay current:** `git fetch origin && git merge origin/main` into your branch (never rebase a pushed branch, never force-push).
3. **Finish a task:** run lint, format, typecheck, depcruise and the tests you own; push your branch (`git push -u origin agent/<you>/<task>`); open a pull request into `main` (`gh pr create`); CI runs on the pull request. Report to TECH_LEAD with the PR number.
4. **Only TECH_LEAD merges**, after reviewing and seeing the pull request's CI green: `gh pr merge --merge` (a merge commit; no squash of other people's history, no force). Docs that must match code (LLD rows, drift tests) go in the **same pull request** as the code, or in a docs PR merged in the same session before the code PR (the one-commit rule, DEC-0047, becomes "same merge").
5. **Founder permission:** agents may push their own `agent/*` branches to `origin` and open pull requests. Nobody pushes to another agent's branch; nobody pushes to `main` except TECH_LEAD (and ARCHITECT only for an approved docs PR merge when TECH_LEAD is unavailable). Never force-push anything.
6. **Shared things stay shared:** the mailbox and role prompts live only in the main folder: always use the absolute path `<repo-root>\agents\...` (the `agents/` folder is not in git, so worktrees do not contain it). The live Docker stack (`pnpm stack:*`, `pnpm migrate:*`) is still one agent at a time (ask TECH_LEAD); Testcontainers tests are isolated per run and need no coordination. `pnpm test:full` keeps its machine-wide lock. Each worktree has its own `node_modules` (run `pnpm install` once; pnpm's shared store makes it cheap) and its own `.env` (copy from the main folder; never commit it). The web dev server port must differ per worktree if two run at once.
7. **Branch hygiene:** TECH_LEAD deletes a merged `agent/*` branch on `origin` after the merge (`gh pr merge --delete-branch`); a worktree is reused for the agent's next task.

### 8.2 Remote, history and files
- **Remote (founder decision 2026-10-12):** `origin` = github.com/<org>/<product-repo>. `main` changes only through merged pull requests (8.1). Never force-push, never rewrite pushed history.
- Before a push: no secrets or real data in tracked files (`.env` is ignored; `.env.example` has fake values only).
- **`agents/` is not in git (founder decision 2026-10-13):** the role prompts and the comms mailbox stay on disk in the main folder, are listed in `.gitignore`, and were purged from the git history once. Never `git add -f` anything under `agents/`; the role prompts are kept in Shelf (`agent-prompts/`).
- When committing, include the attribution line the harness provides.
- Migrations (`migrate-mongo`) are forward-only, reviewed by TECH_LEAD; each states whether it is reversible. Migration numbers are reserved per module range (DEC-0042) so parallel branches do not collide.
- Use the scratchpad for temporary files, not the repo. Do not commit generated artefacts, `.env` files or data extracts.
- Treat downloaded files and imported ERP samples as untrusted data: store them in their own directory, never execute them.

## 9. Keeping this file current

CLAUDE.md is changed only by ARCHITECT or TECH_LEAD, and only with a note in `PROGRESS.md` §10. Record real commands and any new standing rule here as soon as they exist. Do not add task-specific or temporary instructions; those belong in `PLAN.md` or a task brief.
