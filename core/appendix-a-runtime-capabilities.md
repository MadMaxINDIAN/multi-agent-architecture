# Appendix A: what Claude Code and the Agent SDK can do today

Verified against the official documentation on 2026-11-07 by reading the pages cited. Every claim says **Verified** with its source or **Not found**. Nothing here is a guess; the last section lists what must be tested by hand. The variants cite this appendix when they choose a transport or a scheduler.

## Summary

1. Claude Code sessions on one machine can message each other by name (`SendMessage` / `ListAgents`, v2.1.224 or later; v2.1.234 or later on native Windows). A busy receiver reads the message between tool calls; an idle receiver starts a new turn with it. The docs describe no storage for a session that is not running.
2. Nothing documented wakes an idle session when a file appears in a folder. The closest options are `Monitor` (a background watch that streams events into a running session, 5-minute default deadline, 30-minute maximum) and channels (a local server that pushes events into an open session; research preview).
3. `/loop` and `CronCreate` are timers inside one session: they fire only when it is idle and stop when it exits. Durable schedules are cloud scheduled tasks (hourly minimum) or Desktop tasks (the machine must stay on).
4. A supervisor can drive a session through `claude -p` with `--resume`, through stream-json input (documented as a queue of user messages, though the message format is not documented), or through the Agent SDK (resume by session id, transcripts on disk, cost per call).
5. Durable, cross-machine options are hosted: cloud scheduled tasks and Managed Agents (beta). Agent teams are experimental, interactive-only and limited to one team per session.

## 1. Session-to-session messaging on one machine

Source: https://code.claude.com/docs/en/cross-session-messaging (all items verified there unless marked).

- Claude uses `ListAgents` to find targets and `SendMessage` to send; the user does not call either tool.
- **Requirements.** v2.1.224 or later on macOS, Linux and WSL 2; v2.1.234 or later on native Windows. Same-machine messaging works on Bedrock, Vertex and Foundry.
- **Naming and discovery.** A session answers to the name set by `/rename` or `--name`; otherwise Claude Code names it. `/list-agents` (alias `/peers`) lists reachable sessions. When names clash, a short identifier is added.
- **Transport.** Each session binds an inbox socket (Unix socket on macOS and Linux, named pipe on native Windows). Only the same OS user can deliver to it. Local delivery does not pass through Anthropic servers. A session is listed only while it binds a socket.
- **Delivery to a busy session.** The receiving Claude reads the message between tool calls; a running tool is not interrupted.
- **Delivery to an idle session.** A new turn starts with the message.
- **Appearance.** A one-line preview `› Message from @name: ...`; `Ctrl+O` opens the full text. Not documented: whether the message is stored with the `user` role in the model's context.
- **Trust.** A message from another session never counts as consent and cannot answer a permission prompt. Commands in the message (e.g. `/compact`) arrive as plain text.
- **Inbound control.** `crossSessionInbound` takes `accept`, `hold` or `refuse`; the default depends on each session's permission mode. A held message in an interactive session triggers an approval dialog that expires after `dialogExpiry` (5 minutes by default).
- **Limits.** A session holds at most 100 messages, then drops the oldest; a message above about one million characters is refused; bursts to one session are refused at the sender; a receiver queues at most 50 accepted messages; loops are throttled; plain text only.
- **Persistence.** No mailbox or queue is described for a session that is not running. A closed session is not listed, so it cannot be addressed. (Absence of description; treat as not found.)
- **Headless (`-p`) sessions.** They bind a socket and can be listed. Held messages in a `-p` run expire after `dialogExpiry`. To let a `-p` worker accept messages unattended, start it with `crossSessionInbound` set to `accept` in its `--settings`. Bare mode does not bind a socket.
- **Scripts posting to a session.** The socket path is exported as `CLAUDE_CODE_MESSAGING_SOCKET` and a per-session token as `CLAUDE_CODE_MESSAGING_TOKEN`. On native Windows the first line must be an auth line with the token.
- **Across machines.** Remote Control sessions and cloud sessions are listed only while this session is connected to Remote Control; this needs a claude.ai sign-in and does not work with an API key, Bedrock, Vertex or Foundry. Traffic goes through Anthropic servers. A cloud session cannot use `SendMessage` to reply to another machine.
- **Disabling.** Deny `SendMessage` and `ListAgents`, or set `crossSessionInbound` to `refuse`. `isolatePeerMachines` requires approval before any message leaves the machine.
- **Windows.** A session inside WSL 2 and a native Windows session cannot reach each other.

## 2. Waiting on a file-system condition

### Monitor tool

Source: https://code.claude.com/docs/en/tools-reference (Monitor section).

- Runs a command in the background and feeds each output line back to Claude; Claude keeps working and is interrupted when an event arrives. Watching a directory for file changes is a listed use case.
- **Deadline.** 5 minutes by default, 30 minutes at most, 10 minutes at most in a single-prompt `-p` run. At the deadline the watch ends and Claude gets one notice.
- **Stopping.** Ask Claude to cancel it, or end the session. Stopping a subagent stops its monitors.
- **Permissions.** Same rules as Bash.
- **Requirements.** Windows requires Git Bash. Minimum v2.1.310 on Bedrock, Vertex, Foundry, or when telemetry is disabled.
- **Memory cap.** `CLAUDE_CODE_TOOL_MEMORY_LIMIT` covers Monitor on Linux and WSL only.
- **WebSocket source.** A watch can connect to a `ws://` or `wss://` feed instead of running a script.
- **Resume.** `--resume` and `--continue` do not restart monitors that were running when the session ended (https://code.claude.com/docs/en/scheduled-tasks, Limitations).
- **Not found:** the number of concurrent monitors allowed; whether a monitor keeps running while the session sits idle at the prompt.

### Channels (external events pushed into a session)

Sources: https://code.claude.com/docs/en/channels and https://code.claude.com/docs/en/channels-reference.

- A channel is an MCP server that Claude Code starts as a subprocess on the same machine and talks to over stdio. It pushes events into a session that is already open; events arrive only while the session is open.
- **Status.** Research preview. Authentication: claude.ai or a Console API key; not available on Bedrock, Google Cloud's Agent Platform or Microsoft Foundry. Team and Enterprise organisations must enable channels.
- **Enabling.** `--channels plugin:<name>@<marketplace>` for approved plugins (Telegram, Discord, iMessage, fakechat); opted in per session. Custom channels need `--dangerously-load-development-channels`, which is ignored under `-p` or the SDK.
- **Sender gating.** Only allow-listed senders get through; others are dropped silently.
- **Message mechanics.** The server sends `notifications/claude/channel` with `content` and `meta`. Claude Code does not acknowledge notifications, so there is no delivery confirmation. Events queue and are processed in order; several arriving while Claude is busy are delivered together on the next turn.
- **Idle session.** The fakechat quickstart shows an idle session replying to a message typed in the browser; the docs do not state in words that an idle session starts a turn on arrival. Not found as explicit wording.
- **Permission relay.** A channel can forward permission prompts to a phone or chat (v2.1.234 or later).
- **Folder watching.** Only HTTP-POST and chat-platform examples are given. A channel that watches a folder is not documented.

## 3. Scheduling inside a session

Source: https://code.claude.com/docs/en/scheduled-tasks.

- **`/loop` with a fixed interval** (e.g. `/loop 5m ...`) is converted to a cron expression; seconds round up to the minute; odd intervals round to the nearest clean step.
- **Self-paced `/loop`** (no interval): Claude picks a delay between 1 minute and 1 hour after each iteration.
- **Bare `/loop`** runs a built-in maintenance prompt or `.claude/loop.md` (or `~/.claude/loop.md`); content beyond 25,000 bytes is truncated.
- **`CronCreate` / `CronList` / `CronDelete`.** 5-field cron expressions; 8-character ids; at most 50 tasks per session; recurring tasks expire 7 days after creation after one final run.
- **Firing.** The scheduler checks every second; tasks fire between turns; if Claude is busy the prompt waits; no catch-up for missed fires. Recurring tasks start up to half the gap late, capped at 30 minutes (`*/5 * * * *` is not delayed); one-shot tasks on `:00` or `:30` may run up to 90 seconds early.
- **Scope.** Session-scoped: fires only while Claude Code is running and idle; closing the terminal stops it; backgrounding the session carries `/loop` tasks to a background session.
- **Persistence across restarts.** `--resume` and `--continue` restore `CronCreate` tasks except expired recurring tasks, past one-shot tasks and self-paced loops. With feature-flag fetching off, kept tasks are written to `.claude/scheduled_tasks.json` and run only in the folder where they were created.
- **Disabling.** `CLAUDE_CODE_DISABLE_CRON=1`.
- **Target another session.** `CronCreate` schedules "within the current session". Not found: any way to target a different session.
- **`ScheduleWakeup`.** Named as the tool behind self-paced loops (`stop: true` ends a loop; a fallback wake-up about 20 minutes later if an iteration neither reschedules nor stops). Its parameters are not documented in the pages read.
- **Cloud and Desktop alternatives.** Cloud tasks: 1-hour minimum. Desktop tasks: 1-minute minimum when Claude sets it, 1 hour in the forms; the machine must be on.

## 4. Hooks

Source: https://code.claude.com/docs/en/hooks.

- **33 events:** `SessionStart`, `Setup`, `UserPromptSubmit`, `UserPromptExpansion`, `PreToolUse`, `PermissionRequest`, `PermissionDenied`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `Notification`, `MessageDisplay`, `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, `Stop`, `StopFailure`, `TeammateIdle`, `InstructionsLoaded`, `ConfigChange`, `CwdChanged`, `DirectoryAdded`, `FileChanged`, `WorktreeCreate`, `WorktreeRemove`, `PreCompact`, `PostCompact`, `PreModelSwitch`, `PostModelSwitch`, `Elicitation`, `ElicitationResult`, `SessionEnd`.
- **Events caused by something outside the session's own actions:** `FileChanged` (a watched file changes on disk; the matcher takes literal file names); `ConfigChange` (a config file changes during a session; that it fires for external edits is not stated outright); `Elicitation` (an MCP server requests input); `DirectoryAdded` (`/add-dir` or an SDK request).
- **Not found:** a hook for timers, cross-session messages or channel events; whether any hook can start a new turn when the session is idle.
- **Injecting text.** `hookSpecificOutput.additionalContext` adds text for Claude on `SessionStart`, `SubagentStart`, `UserPromptSubmit`, `UserPromptExpansion`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `Stop`, `SubagentStop` and `PostModelSwitch`. `systemMessage` shows a warning to the user, not to Claude.
- **Hooks posting into a session.** Hooks receive `CLAUDE_CODE_MESSAGING_SOCKET`, so a hook can post a message into its own session (https://code.claude.com/docs/en/cross-session-messaging).

## 5. Driving sessions programmatically

### `claude -p` (headless)

Sources: https://code.claude.com/docs/en/headless and https://code.claude.com/docs/en/cli-reference.

- `claude -p` runs a prompt and exits; exit code 0 on success.
- `--output-format json` returns `session_id`, `total_cost_usd` and a per-model breakdown (both figures are client-side estimates). `--output-format stream-json` with `--verbose` and `--include-partial-messages` streams events. `--json-schema` gives structured output.
- `--resume <id>` or `--continue` continues a session; `--session-id <uuid>` sets an id; `--no-session-persistence` stops saving.
- `--max-budget-usd` caps spend. Permissions: `--allowedTools`, `--permission-mode`, `--permission-prompts none`; from v2.1.302, `-p` runs start in Manual mode when nothing sets a mode. `--bare` is recommended for scripts and SDK calls.
- After stdin closes, a `-p` run waits for background commands, subagents, workflows and monitors, up to a 10-minute cap by default.
- **Stream-json input.** `--input-format` accepts `text` or `stream-json` (example: `claude -p --input-format stream-json --output-format stream-json --verbose`). `--replay-user-messages` re-emits user messages read from stdin. The `--max-turns` entry states that with stream-json input "a message still queued when the limit ends a turn stays queued and starts a new turn with its own limit", which confirms that a `-p` process reads further user messages from stdin and starts a turn for each. The headless page says a run waits for each self-paced wake-up except when the prompt arrives through stream-json input.
- **Not found:** the JSON schema of each stdin user message; whether a supervisor can send more messages after the first turn without the schema; whether closing stdin ends the process.
- Background sessions: `claude --bg "task"` starts one; `--bg` cannot be combined with `-p` (https://code.claude.com/docs/en/agent-view).

### Agent SDK (TypeScript and Python)

Sources: https://code.claude.com/docs/en/agent-sdk/overview, https://code.claude.com/docs/en/agent-sdk/sessions, https://code.claude.com/docs/en/agent-sdk/custom-tools, https://code.claude.com/docs/en/agent-sdk/mcp.

- Built-in tools, hooks, subagents, MCP, permissions, sessions and plugins are all available in the SDK.
- Sessions are stored as JSONL under `~/.claude/projects/<encoded-cwd>/`. Resume by id with `resume`; continue the most recent session with `continue` (TypeScript) or `continue_conversation` (Python); fork with `fork_session` / `forkSession`.
- Long-lived sessions: Python `ClaudeSDKClient` keeps one session across several `query()` calls; TypeScript uses `continue: true` on each call. `persistSession: false` (TypeScript) keeps the session in memory only. Cross-host resume needs a `SessionStore` adapter or moving the file.
- Cost: each `query()` returns its own `total_cost_usd`; summing across calls is the caller's job.
- Permissions: `permissionMode` and a `canUseTool` callback are documented.
- **Custom tools and MCP.** Custom tools are defined in application code and run in-process: TypeScript `tool()` and `createSdkMcpServer()` with a Zod schema; Python `@tool` and `create_sdk_mcp_server()` with a dict schema or full JSON Schema. The server is passed in `mcpServers` and each tool is named `mcp__<server>__<tool>` in `allowedTools` (wildcards allowed). Tool search is on by default and defers tool definitions. TypeScript only: a tool can be set to `always_ask` through `permission_policy`. The Python `@tool` decorator forwards only `content` and `is_error`, so `structuredContent` needs a standalone MCP server. External MCP servers are configured in `mcpServers` as `stdio`, `http` or `sse`, or loaded from `.mcp.json` when the `project` setting source is on; credentials go in `env` or `headers`; the SDK does not run an OAuth browser flow. Not found: how the tool list behaves when tools change mid-session.

### Agent teams and subagents

Sources: https://code.claude.com/docs/en/agent-teams and https://code.claude.com/docs/en/sub-agents.

- Agent teams are experimental and off by default (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). Not spawned in `-p` or SDK sessions. One team per session; no nested teams; teammates cannot run background subagents; in-process teammates are not restored by `/resume` or `/rewind`. Mailboxes are JSON files under `~/.claude/teams/{team-name}/inboxes/`; the team config is removed when the session ends, the task list stays. "There is no hard limit on the number of teammates." Split-pane mode is not supported in Windows Terminal.
- Subagents: nesting up to three layers by default (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`); 20 concurrent by default (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); no cap on the total per session. `isolation: worktree` runs a subagent in a temporary git worktree. A subagent is resumed with `SendMessage` to its id or name (this does not need agent teams). Named subagents with `SendMessage` can message each other.

### Dynamic workflows (the `Workflow` tool)

Source: https://code.claude.com/docs/en/workflows.

- Up to 16 concurrent agents by default (`CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS`, 1 to 256); 1,000 agents per run; up to 4,096 items per `parallel()` or `pipeline()` call.
- No mid-run user input; the run pauses only for permission prompts and usage-limit waits (up to a 24-hour reset window, at most two waits). Stalled agents restart up to five times.
- Resume by relaunching: completed agents return saved results; the first agent whose prompt changes reruns, with all later agents. Backgrounding the session does not keep the run going.
- Scripts run in a sandbox with no module loading and no direct file-system access.
- Not found: a wall-clock limit on a run; whether workflow agents can message each other or live long.

## 6. Scheduled cloud agents (routines)

Source: https://code.claude.com/docs/en/routines (research preview) and https://code.claude.com/docs/en/scheduled-tasks.

- A saved prompt, one or more repositories and connectors, run on Anthropic-managed cloud or a self-hosted environment.
- **Triggers.** Schedule (presets or cron), API (HTTP POST to `/fire` with a bearer token; beta header `experimental-cc-routine-2026-04-01`), GitHub events (pull requests, releases).
- **Schedule minimum.** 1 hour; more frequent expressions are rejected.
- **Hourly limits.** Scheduled runs: 100 per hour per account. "Run now", API fires and one-off runs: 30 per hour per task; API fires 100 per hour per account. No overage.
- **GitHub access.** Needed to clone the repositories; the Claude GitHub App must be installed for GitHub triggers. Each repository is cloned at the start of each run from the default branch unless the prompt says otherwise; Claude creates `claude/`-prefixed branches for its changes. Not found: pushing beyond `claude/` branches; persistent state between runs; a run duration limit.
- **Network.** The default environment has a trusted allow-list.
- **Cost.** Draws down subscription usage like interactive sessions; overage only with usage credits on. Available on Pro, Max, Ultra, Team and Enterprise.
- **Failure mode.** If GitHub access is missing, runs are skipped for up to 72 hours before the task turns off.
- **Repository-mailbox pattern.** A routine can read files from a cloned repository and write to `claude/` branches, but runs only when a trigger fires, so it cannot watch a mailbox continuously.

## 7. Workflow tool

See §5, Dynamic workflows: 16 concurrent agents by default, 1,000 per run, 4,096 items per fan-out call, no mid-run input, resume by relaunch, no documented wall-clock limit, no documented agent-to-agent messaging. The bundled `/deep-research` workflow is documented on the same page.

## 8. Resource footprint

- Memory and CPU per Claude Code session: not found. Recommended concurrent sessions per machine: not found.
- Documented limits that bound concurrency: 20 concurrent subagents, 16 concurrent workflow agents. The routines page mentions an organisation-wide limit on cloud sessions running at once, with no number.
- Monitor memory cap on Linux and WSL only (§2).

## 9. Managed Agents

Sources: https://platform.claude.com/docs/en/managed-agents/overview, https://platform.claude.com/docs/en/managed-agents/sessions, https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration.

- **Status.** Beta; requires the `managed-agents-2026-04-01` beta header. Anthropic-hosted agent harness; sessions run in a managed cloud sandbox or a self-hosted sandbox.
- **Tools.** Bash, file operations, web search and fetch, MCP servers.
- **Sessions.** Stateful; transcripts persist until deleted. Scheduled deployments give recurring cron runs.
- **Multi-agent.** Subagents run as threads inside one session; a subagent keeps its history and the primary agent can send it a follow-up; the advisor is a separate thread; 25-child-thread limit per session. Messaging between separate sessions: not found.
- **Budgets.** A session can take a budget at creation (`max_list_cost`, US cents as a string, USD only) and stops with `budget_reached`.
- **Data handling.** Not eligible for zero data retention or HIPAA.
- **Not found:** session lifetime and idle expiry; pricing (the page returned 404).

## Suitability table

| Mechanism | Wake-up on new message | Durable record | Cross-machine | Programmatic control |
|---|---|---|---|---|
| Cross-session `SendMessage` (same machine) | Yes (new turn if idle; read between tool calls if busy) | No | No | Partial (agent-driven; external post via socket with token) |
| Cross-session via Remote Control | Partial (offline peers get it on reconnect) | Partial (cloud transcript only) | Yes | Partial (claude.ai sign-in only) |
| Channels (research preview) | Yes (events arrive in an open session) | No (no acknowledgement; not stored) | No (same machine) | Partial (custom channels need a development flag) |
| `Monitor` tool | Yes (only while the session runs) | No | No | Partial |
| `/loop` and `CronCreate` | Partial (timer, not event; only when idle) | No | No | Partial (in-session only) |
| `ScheduleWakeup` | Partial (timer) | No | No | Partial (parameters not documented) |
| Hooks (e.g. `FileChanged`) | No (no documented way to start a turn) | No | No | Partial |
| `claude -p` with `--resume` | No (the supervisor must invoke it) | Yes (session on disk) | Partial (move the transcript) | Yes |
| `claude -p` with stream-json input | Yes (each queued message starts a turn) | Yes (session on disk unless disabled) | Partial (move the transcript) | Partial (message format not documented) |
| Agent SDK sessions | No (the process must call it) | Yes (JSONL) | Partial (`SessionStore` adapter) | Yes |
| Agent view (`claude --bg`) | Partial (needs-input state; peek and reply) | Yes (survives terminal closing) | No | Yes (`claude agents --json --all`) |
| Agent teams (experimental) | Yes (automatic delivery to teammates) | Partial (mailbox files; team config removed at exit) | No | Partial (interactive only) |
| Subagents with `SendMessage` resume | Partial (in-session) | Yes (agent transcripts) | No | Partial (in-session only) |
| Dynamic workflows | No (no mid-run input) | Partial (saved results and script) | No | Partial |
| Cloud scheduled tasks | Yes for API and GitHub triggers (schedules: 1-hour minimum) | Yes (run history; fresh clone each run) | Yes | Yes (`/fire` endpoint) |
| Repository as mailbox, read by a cloud task | Partial (only when a trigger fires) | Yes (git history) | Yes | Yes (`claude/` branches documented; other pushes not found) |
| Desktop scheduled tasks | Partial (1-minute minimum when Claude sets it) | Yes (local) | No | Partial |
| Managed Agents (beta) | Yes (API events; scheduled deployments) | Yes (until deleted) | Yes | Yes (API) |

## Not documented / to test by hand

- Whether an idle session starts a turn on a channel event, in words rather than by the fakechat example.
- Number of concurrent `Monitor` watches allowed; whether a monitor keeps running while the session sits idle at the prompt.
- Stream-json input: the JSON format of each stdin message; whether stdin closing ends the process; whether a supervisor can keep feeding turns for hours.
- Whether a cross-session message is stored as a `user` message in the model's context.
- What happens to a message sent to a session that has just exited (expected: not listed, so not addressable).
- `ScheduleWakeup` parameters; whether `CronCreate` can target another session.
- Whether any hook can start a turn; whether any hook fires on a cross-session or channel event.
- Routine run duration limit; routine state between runs; whether routines can push beyond `claude/` branches or open pull requests unattended.
- Workflow wall-clock limit; whether workflow agents can message each other.
- Resource footprint per session and the safe concurrent session count per machine.
- Managed Agents: session lifetime and idle expiry; pricing; messaging between separate sessions.
- Agent SDK: Python per-model cost (`model_usage`); how tool lists behave when tools change mid-session.
- Channels: whether a folder-watching channel is supported; whether channels work reliably under `-p` in an unattended run.
- Windows: `Monitor` depends on Git Bash; cross-session messaging uses a named pipe with an auth line; split-pane agent teams are not available in Windows Terminal.
