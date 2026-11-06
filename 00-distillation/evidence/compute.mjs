#!/usr/bin/env node
/**
 * compute.mjs — read-only analysis of the Remitly agent mailbox.
 *
 * Usage:  node compute.mjs [<path to agents/comms>]
 * Default path: C:\Repos\remitly\agents\comms
 *
 * Reads archive/**, inbox/** and status/* (never writes there) and writes
 * CSV/JSON tables into ./out next to this script. Dependency-free, Node 22.
 *
 * Robustness notes
 *  - Filenames are parsed leniently: a timestamp with colons (20261021T05:21:33Z)
 *    is normalised and flagged; the TYPE is the first token after `_to_<TO>_`
 *    (CHANGE_REQUEST is recognised as one token); anything after it is the suffix.
 *  - Two clocks are recorded per message: the timestamp the sender put in the file
 *    name (`ts_name`) and the file's last-write time on disk (`ts_mtime`). A rename
 *    on NTFS keeps mtime, so mtime is the sender's real wall clock whenever the
 *    receiver moved (not copied) the file. Both are reported; the write-up says which
 *    one each number uses.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.argv[2] ?? 'C:\\Repos\\remitly\\agents\\comms';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const RUN_AT = new Date();

const KNOWN_ROLES = [
  'SENIOR_ENGINEER-1', 'SENIOR_ENGINEER-2', 'SENIOR_ENGINEER-3', 'SENIOR_ENGINEER-4',
  'TECH_LEAD', 'ARCHITECT', 'CODE_REVIEWER', 'QA', 'FOUNDER', 'ALL',
];
const AGENTS = KNOWN_ROLES.filter((r) => r !== 'FOUNDER' && r !== 'ALL');
const PROTOCOL_TYPES = ['TASK', 'REPORT', 'VERDICT', 'QUESTION', 'ANSWER', 'REQUEST', 'CHANGE_REQUEST', 'BLOCKER', 'INFO', 'HANDOFF'];
const PROTOCOL_PRIORITIES = ['P0', 'P1', 'P2'];
const REQUIRED_FIELDS = ['from', 'to', 'type', 'priority', 'ref', 'reply_to', 'needs_reply_by'];
const CADENCE_MIN = {
  ARCHITECT: 30, TECH_LEAD: 15, CODE_REVIEWER: 15, QA: 10,
  'SENIOR_ENGINEER-1': 5, 'SENIOR_ENGINEER-2': 5, 'SENIOR_ENGINEER-3': 5, 'SENIOR_ENGINEER-4': 5,
};
// Routes the protocol allows (README §3: engineers, QA and CODE_REVIEWER only message TECH_LEAD;
// founder-bound messages go through ARCHITECT or TECH_LEAD). FOUNDER is a human and may write to anyone.
function routeAllowed(from, to) {
  if (from === 'FOUNDER') return true;
  const spoke = (r) => r.startsWith('SENIOR_ENGINEER') || r === 'QA' || r === 'CODE_REVIEWER';
  if (spoke(from)) return to === 'TECH_LEAD';
  if (from === 'TECH_LEAD') return to === 'ARCHITECT' || to === 'FOUNDER' || spoke(to) || to === 'ALL';
  if (from === 'ARCHITECT') return to === 'TECH_LEAD' || to === 'FOUNDER';
  return false;
}

// ---------- helpers ----------
// Scrub personal identifiers before anything is written: Windows/POSIX home paths, e-mail addresses, GitHub org/repo URLs.
function scrub(s) {
  return String(s)
    .replace(/[A-Za-z]:\\Users\\[^\\/"'\s,;)]+/g, '<home>')
    .replace(/\/(?:c|mnt\/c)\/Users\/[^\/"'\s,;)]+/gi, '<home>')
    .replace(/\bUsers\\[^\\/"'\s,;)]+/g, 'Users\\<name>')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>')
    .replace(/(https?:\/\/)?(www\.)?github\.com\/[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)?/g, '<github-repo>');
}
const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = scrub(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function writeCsv(name, header, rows) {
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map((h) => csvCell(r[h])).join(','));
  fs.writeFileSync(path.join(OUT, name), lines.join('\n') + '\n', 'utf8');
}
function writeJson(name, obj) {
  const text = JSON.stringify(obj, (k, v) => (typeof v === 'string' ? scrub(v) : v), 2);
  fs.writeFileSync(path.join(OUT, name), text + '\n', 'utf8');
}
const iso = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString().replace(/\.\d{3}Z$/, 'Z') : '');
const day = (d) => (d ? iso(d).slice(0, 10) : '');
const minutes = (ms) => Math.round((ms / 60000) * 10) / 10;
function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
function stats(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return { count: 0 };
  return {
    count: v.length,
    min: Math.round(v[0] * 10) / 10,
    median: Math.round(quantile(v, 0.5) * 10) / 10,
    p90: Math.round(quantile(v, 0.9) * 10) / 10,
    max: Math.round(v[v.length - 1] * 10) / 10,
    mean: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10,
  };
}
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

// ---------- filename parsing ----------
function parseTimestamp(raw) {
  // accepts 20261021T052133Z and 20261021T05:21:33Z (flagged)
  const hadColons = raw.includes(':');
  const clean = raw.replace(/:/g, '');
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(clean);
  if (!m) return { date: null, hadColons, ok: false };
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  const ok = !Number.isNaN(d.getTime()) && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31 && +m[4] < 24 && +m[5] < 60 && +m[6] < 60;
  return { date: ok ? d : null, hadColons, ok, missingZ: !raw.endsWith('Z') };
}
function parseFilename(fileName) {
  const flags = [];
  const base = fileName.replace(/\.md$/i, '');
  if (!/\.md$/i.test(fileName)) flags.push('not_md');
  const firstUs = base.indexOf('_');
  const tsRaw = firstUs >= 0 ? base.slice(0, firstUs) : base;
  const ts = parseTimestamp(tsRaw);
  if (!ts.ok) flags.push('bad_timestamp');
  if (ts.hadColons) flags.push('colons_in_timestamp');
  if (ts.missingZ) flags.push('timestamp_missing_Z');
  const rest = firstUs >= 0 ? base.slice(firstUs + 1) : '';
  const toIdx = rest.indexOf('_to_');
  let from = '', to = '', type = '', suffix = '', tail = '';
  if (toIdx < 0) {
    flags.push('no_to_separator');
    from = rest;
  } else {
    from = rest.slice(0, toIdx);
    const after = rest.slice(toIdx + 4);
    const role = KNOWN_ROLES
      .filter((r) => after === r || after.startsWith(r + '_'))
      .sort((a, b) => b.length - a.length)[0];
    if (role) {
      to = role;
      tail = after.slice(role.length + 1);
    } else {
      flags.push('unknown_to');
      const u = after.indexOf('_');
      to = u >= 0 ? after.slice(0, u) : after;
      tail = u >= 0 ? after.slice(u + 1) : '';
    }
    if (tail.startsWith('CHANGE_REQUEST')) {
      type = 'CHANGE_REQUEST';
      suffix = tail.slice('CHANGE_REQUEST'.length).replace(/^_/, '');
    } else {
      const u = tail.indexOf('_');
      type = u >= 0 ? tail.slice(0, u) : tail;
      suffix = u >= 0 ? tail.slice(u + 1) : '';
    }
    if (!type) flags.push('empty_type');
    else if (type !== type.toUpperCase()) flags.push('lowercase_type');
  }
  if (!KNOWN_ROLES.includes(from)) flags.push('unknown_from');
  return { id: base, ts_name: ts.date, ts_name_raw: tsRaw, from, to, type, suffix, tail, flags };
}

// ---------- front matter ----------
function parseFrontMatter(text) {
  const lines = text.split(/\r?\n/);
  const fm = {}; const present = new Set(); const order = [];
  let start = -1, end = -1;
  for (let i = 0; i < Math.min(lines.length, 5); i++) if (lines[i].trim() === '---') { start = i; break; }
  if (start >= 0) {
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') { end = i; break; }
      const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(lines[i]);
      if (m) {
        let v = m[2].replace(/\s+#.*$/, '').trim(); // strip template comments
        fm[m[1].toLowerCase()] = v; present.add(m[1].toLowerCase()); order.push(m[1].toLowerCase());
      }
    }
  }
  const hasFm = start >= 0 && end > start;
  const body = hasFm ? lines.slice(end + 1).join('\n') : text;
  return { fm, present, hasFm, body, order };
}
function subjectOf(body) {
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    return t.replace(/^#+\s*/, '').slice(0, 200);
  }
  return '';
}
const NONE_VALUES = new Set(['', 'none', 'n/a', 'na', '-', '—', 'null', 'nil', '(none)']);
function replyTokens(raw) {
  if (raw === undefined || raw === null) return [];
  const s = String(raw).trim();
  if (NONE_VALUES.has(s.toLowerCase())) return [];
  return s.split(/[,;\s]+/).map((t) => t.replace(/^.*[\\/]/, '').replace(/\.md$/i, '').replace(/[`'"()]/g, ''))
    .filter((t) => t.includes('_to_'));
}
const REF_TOKEN_RE = /\b(T-\d+(?:\.\d+)+[a-z]?|WP[-\s]?[\dA-Za-z]+(?:\.\d+)*[a-z]?|BUG-\d{4}|CR-\d{4}|C\d{1,2}[a-z]?|PR\s?#?\d{1,3}|#\d{1,3}|QA-[A-Z]|DEC-\d{4})\b/g;
function refTokens(ref) {
  const out = new Set();
  for (const m of String(ref ?? '').matchAll(REF_TOKEN_RE)) out.add(m[1].replace(/\s+/g, '').toUpperCase());
  return out;
}
function intersects(a, b) { for (const x of a) if (b.has(x)) return true; return false; }

// ---------- keyword classifiers ----------
const KEYWORDS = {
  resend: /\bre-?send|\bre-?sent\b|send(ing)? (it )?again|sent again|copy of (my|the) (earlier|previous)/i,
  nohistory: /nohistory|no history/i,
  api_down: /api_down|api (is )?down|api not (running|answering)/i,
  restart: /\brestart(ed|ing)?\b/i,
  unresponsive: /unresponsive|not responding|no (heartbeat|loop)|silent since|has been silent|not running|offline|went quiet|usage limit|session (limit|ended|stopped)/i,
  inbox_deleted: /deleted (files|messages) in my inbox|inbox by mistake/i,
  memory: /\bfree mem(ory)?\b|\bram\b|\bgb free\b|low ?mem|out of memory|memory pressure|quiet (window|laptop)/i,
  stack_window: /stack window|live stack|stack:up|stack:down|window (start|done|end)|the window is/i,
  ci: /\bci\b|github actions|billing|workflow run/i,
  freeze: /\bfreeze\b|\bfrozen\b|unfreeze|freeze lifted/i,
  lock: /\btest:full\b|machine-wide lock|the lock\b/i,
  pr: /\bpr #?\d+|pull request|\bmerged\b/i,
  eta: /\beta\b|received,? (will|eta)|\back(nowledged)?\b|^received\b|got it\b/i,
  status: /\bstatus\b|heartbeat|standing by|\bidle\b|checking in|check-in|still (here|working|alive)/i,
};
function keywordHits(text) {
  const hits = [];
  for (const [k, re] of Object.entries(KEYWORDS)) if (re.test(text)) hits.push(k);
  return hits;
}
// INFO purpose classes (first match wins); the write-up validates this on a read sample.
// The six classes are the ones the brief asks for; "other" is split into sub-classes for transparency.
function classifyInfo(m) {
  const head = `${m.suffix} ${m.subject}`.toLowerCase();
  const first = (m.subject + ' ' + m.body_head.slice(0, 300)).toLowerCase();
  const rules = [
    ['resend', 'resend', /resend|re-send|sent again|send it again|copy of (my|the) (earlier|last)/],
    ['freeze/ack', 'freeze', /\bfreeze\b|\bfrozen\b|unfreeze|unfrozen|freeze (lifted|ack)/],
    ['ack/received/eta', 'ack', /^(ack|received|got it|noted|will do|on it|understood)\b|\back\b|\breceived[,.;:]|\beta\b|received your|acknowledg|thanks,? (got|received)|will (report|reply) (by|at|when)/],
    ['machine coordination', 'machine', /memory|free mem|\bgb\b|\bram\b|stack window|stack:|live stack|shared stack|window (start|done|end|request|is)|the lock\b|test:full|docker|container|\bci\b|billing|github actions|laptop|quiet window|port \d{4}|dev server|tunnel|api(_| )down|api is (up|down)|restart|worktree|pnpm install|node_modules|lowmem|vitest|testcontainers|mongo/],
    ['status/heartbeat', 'status', /\bstatus\b|heartbeat|standing by|stand by|\bidle\b|checking in|check-in|still (here|alive)|progress (update|note)|where i am|what i am doing|interim|eod|end of day|no open prs|nothing outstanding|waiting for (a|the next) task/],
  ];
  for (const [cls, key, re] of rules) if (re.test(head) || re.test(first)) return [cls, key];
  // sub-classes of "other"
  const sub = [
    ['other: repo/merge notice', /committed|pushed|merged|\bmain is\b|pull request|\bpr\b|#\d{1,3}\b|branch|tag(ged)?\b|rebase/],
    ['other: work note (progress, hand-off, finding)', /\b(done|built|ready|finished|complete[d]?|landed|fixed|found|finding|note|fyi|heads-up|heads up|for your (information|records))\b|slice|step \d/],
    ['other: planning/decision relay', /decid|approved|plan\b|scope|priority|founder|architect|demo|deadline|schedule|next (task|up)|queue/],
  ];
  for (const [cls, re] of sub) if (re.test(first)) return [cls, 'other-sub'];
  return ['other: unclassified', ''];
}
const INFO_TOP = (cls) => (cls.startsWith('other') ? 'other' : cls);
// Blocker / P0 cause classes (first match wins), used for section 6 of the write-up.
function classifyBlocker(m) {
  const t = (m.subject + ' ' + m.body_head).toLowerCase();
  const rules = [
    ['waiting on founder', /founder/],
    ['waiting on another agent', /silent|idle since|unresponsive|not (running|responding|answering)|no (reply|answer|verdict) (yet|from)|waiting for (your|the|a) (verdict|answer|reply|review|approval|decision|go)|usage limit|session (limit|ended|stopped)|still waiting|has not (replied|answered)|crossed/],
    ['compute/memory on the shared laptop', /memory|free mem|\bgb\b|\bram\b|laptop|quiet window|lowmem|too many (containers|workers)|oom|out of memory|machine is (busy|loaded)/],
    ['CI', /\bci\b|github actions|billing|workflow/],
    ['design gap / contract missing', /contract|spec(ification)?\b|design\b|architect|\blld\b|schema|adr-|ambigu|unclear|missing (route|field|endpoint|capability)|not (defined|specified)|decision needed|which (option|of)/],
    ['environment / tooling', /docker|stack|port \d{3,5}|\bnode\b|pnpm|install|worktree|\bgit\b|mongo|container|api (is )?down|restart|lock\b|flaky|timed? ?out|playwright|browser|chromium|vitest|testcontainers|\.env\b|secret|key\b/],
  ];
  for (const [cls, re] of rules) if (re.test(t)) return cls;
  return 'other';
}

// ---------- load messages ----------
const messages = [];
const foreign = []; // files in the mailbox folders that are not .md messages
const dirs = [['archive', path.join(ROOT, 'archive')], ['inbox', path.join(ROOT, 'inbox')]];
for (const [folder, dir] of dirs) {
  for (const p of walk(dir)) {
    const name = path.basename(p);
    if (name === '.gitkeep') continue;
    const st = fs.statSync(p);
    if (!st.isFile()) continue;
    const rel = path.relative(ROOT, p).split(path.sep).join('/');
    if (!/\.md$/i.test(name)) { foreign.push({ file: rel, bytes: st.size, mtime: iso(st.mtime) }); continue; }
    const sub = rel.split('/').slice(1, -1).join('/'); // archive/<phase> or inbox/<ROLE>
    const parsed = parseFilename(name);
    let text = '';
    try { text = fs.readFileSync(p, 'utf8'); } catch { parsed.flags.push('unreadable'); }
    const { fm, present, hasFm, body } = parseFrontMatter(text);
    if (!hasFm) parsed.flags.push('no_front_matter');
    const subject = subjectOf(body);
    const bodyHead = body.replace(/\s+/g, ' ').trim().slice(0, 600);
    const missing = REQUIRED_FIELDS.filter((f) => !present.has(f));
    const empty = REQUIRED_FIELDS.filter((f) => present.has(f) && NONE_VALUES.has(String(fm[f]).toLowerCase()) && f !== 'reply_to' && f !== 'needs_reply_by');
    const emptyStrict = REQUIRED_FIELDS.filter((f) => present.has(f) && String(fm[f]).trim() === '');
    const fmType = (fm.type ?? '').toUpperCase().trim();
    const fmFrom = (fm.from ?? '').trim();
    const fmTo = (fm.to ?? '').trim();
    const m = {
      id: parsed.id, file: rel, folder, subfolder: sub, bytes: st.size,
      ts_name: parsed.ts_name, ts_name_raw: parsed.ts_name_raw,
      ts_mtime: st.mtime, ts_birth: st.birthtime,
      from: parsed.from, to: parsed.to, type: parsed.type, suffix: parsed.suffix, tail: parsed.tail,
      flags: parsed.flags,
      fm_from: fmFrom, fm_to: fmTo, fm_type: fmType, fm_priority: (fm.priority ?? '').trim(),
      fm_ref: fm.ref ?? '', fm_reply_to: fm.reply_to ?? '', fm_needs_reply_by: fm.needs_reply_by ?? '', fm_sent_utc: fm.sent_utc ?? '',
      missing_fields: missing, empty_fields: emptyStrict, has_front_matter: hasFm,
      subject, body_head: bodyHead, body, body_lines: body.split('\n').length, body_words: body.split(/\s+/).filter(Boolean).length,
      ref_tokens: refTokens(fm.ref), reply_tokens: replyTokens(fm.reply_to),
      keywords: keywordHits(`${parsed.suffix} ${subject} ${body}`),
    };
    m.fm_mismatch = [];
    if (fmFrom && fmFrom !== m.from) m.fm_mismatch.push('from');
    if (fmTo && fmTo !== m.to) m.fm_mismatch.push('to');
    if (fmType && fmType !== m.type) m.fm_mismatch.push('type');
    m.ts = m.ts_name ?? m.ts_mtime; // for ordering: sender-stated time, else mtime
    m.skew_min = m.ts_name ? minutes(m.ts_mtime - m.ts_name) : null;
    messages.push(m);
  }
}
messages.sort((a, b) => (a.ts - b.ts) || a.id.localeCompare(b.id));
const byId = new Map(messages.map((m) => [m.id, m]));
const byIdNoColon = new Map(messages.map((m) => [m.id.replace(/:/g, ''), m]));
const archive = messages.filter((m) => m.folder === 'archive');
const inbox = messages.filter((m) => m.folder === 'inbox');

// ---------- reply_to resolution ----------
for (const m of messages) {
  m.reply_resolved = []; m.reply_dangling = []; m.reply_fuzzy = [];
  for (const t of m.reply_tokens) {
    if (byId.has(t)) { m.reply_resolved.push(t); continue; }
    const nc = byIdNoColon.get(t.replace(/:/g, ''));
    if (nc) { m.reply_resolved.push(nc.id); m.reply_fuzzy.push(`${t} -> ${nc.id} (colons)`); continue; }
    // fuzzy: same FROM/TO/TYPE, timestamp within 10 minutes, any suffix
    const p = parseFilename(t + '.md');
    let best = null;
    if (p.ts_name) {
      for (const c of messages) {
        if (c.from !== p.from || c.to !== p.to || c.type !== p.type || !c.ts_name) continue;
        const d = Math.abs(c.ts_name - p.ts_name);
        if (d <= 10 * 60000 && (!best || d < best.d)) best = { c, d };
      }
    }
    if (best) { m.reply_resolved.push(best.c.id); m.reply_fuzzy.push(`${t} -> ${best.c.id} (${minutes(best.d)} min off)`); }
    else m.reply_dangling.push(t);
  }
}

// ---------- tables: scale and shape ----------
const count = (arr, key) => {
  const map = new Map();
  for (const x of arr) { const k = key(x); map.set(k, (map.get(k) ?? 0) + 1); }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
};
writeCsv('messages.csv',
  ['id', 'folder', 'subfolder', 'ts_name', 'ts_mtime', 'ts_birth', 'skew_min', 'from', 'to', 'type', 'suffix', 'fm_from', 'fm_to', 'fm_type', 'fm_priority', 'fm_ref', 'fm_reply_to', 'fm_needs_reply_by', 'fm_sent_utc', 'reply_resolved', 'reply_dangling', 'reply_fuzzy', 'missing_fields', 'empty_fields', 'fm_mismatch', 'flags', 'route_allowed', 'keywords', 'bytes', 'body_lines', 'body_words', 'subject'],
  messages.map((m) => ({
    id: m.id, folder: m.folder, subfolder: m.subfolder, ts_name: iso(m.ts_name), ts_mtime: iso(m.ts_mtime), ts_birth: iso(m.ts_birth), skew_min: m.skew_min,
    from: m.from, to: m.to, type: m.type, suffix: m.suffix, fm_from: m.fm_from, fm_to: m.fm_to, fm_type: m.fm_type, fm_priority: m.fm_priority, fm_ref: m.fm_ref,
    fm_reply_to: m.fm_reply_to, fm_needs_reply_by: m.fm_needs_reply_by, fm_sent_utc: m.fm_sent_utc,
    reply_resolved: m.reply_resolved.join(' '), reply_dangling: m.reply_dangling.join(' '), reply_fuzzy: m.reply_fuzzy.join(' | '),
    missing_fields: m.missing_fields.join(' '), empty_fields: m.empty_fields.join(' '), fm_mismatch: m.fm_mismatch.join(' '), flags: m.flags.join(' '),
    route_allowed: routeAllowed(m.from, m.to) ? 'yes' : 'NO', keywords: m.keywords.join(' '), bytes: m.bytes, body_lines: m.body_lines, body_words: m.body_words, subject: m.subject,
  })));

writeCsv('by_type.csv', ['type', 'in_protocol', 'count', 'share_pct', 'median_words', 'p90_words', 'first_seen', 'last_seen', 'senders'],
  count(archive, (m) => m.type).map(([type, n]) => {
    const ms = archive.filter((m) => m.type === type);
    const w = stats(ms.map((m) => m.body_words));
    return { type, in_protocol: PROTOCOL_TYPES.includes(type) ? 'yes' : 'no', count: n, share_pct: Math.round((n / archive.length) * 1000) / 10, median_words: w.median, p90_words: w.p90,
      first_seen: iso(ms[0].ts), last_seen: iso(ms[ms.length - 1].ts), senders: count(ms, (m) => m.from).map(([k, v]) => `${k}:${v}`).join(' ') };
  }));
// broadcasts: one logical message copied into several inboxes (front matter `to` is ALL / all / all engineers / SENIOR_ENGINEER-n / engineer)
const isBroadcastTo = (t) => /^(all|all engineers|engineer|senior_engineer-n)$/i.test(t);
const bcast = archive.filter((m) => isBroadcastTo(m.fm_to));
const bcastEvents = new Map();
for (const m of bcast) { const k = `${m.ts_name_raw}|${m.from}|${m.type}|${m.suffix}`; if (!bcastEvents.has(k)) bcastEvents.set(k, []); bcastEvents.get(k).push(m); }
writeCsv('broadcast_events.csv', ['event_key', 'from', 'type', 'copies', 'recipients', 'subject'],
  [...bcastEvents.entries()].map(([k, ms]) => ({ event_key: k, from: ms[0].from, type: ms[0].type, copies: ms.length, recipients: ms.map((m) => m.to).join(' '), subject: ms[0].subject })));
writeCsv('by_sender.csv', ['sender', 'count', 'share_pct', 'first_seen', 'last_seen', 'active_days'],
  count(archive, (m) => m.from).map(([sender, n]) => {
    const ms = archive.filter((m) => m.from === sender);
    return { sender, count: n, share_pct: Math.round((n / archive.length) * 1000) / 10, first_seen: iso(ms[0].ts), last_seen: iso(ms[ms.length - 1].ts), active_days: new Set(ms.map((m) => day(m.ts))).size };
  }));
writeCsv('by_recipient.csv', ['recipient', 'count', 'share_pct'],
  count(archive, (m) => m.to).map(([recipient, n]) => ({ recipient, count: n, share_pct: Math.round((n / archive.length) * 1000) / 10 })));
writeCsv('by_pair.csv', ['from', 'to', 'count', 'share_pct', 'route_allowed', 'types'],
  count(archive, (m) => `${m.from}>${m.to}`).map(([k, n]) => {
    const [from, to] = k.split('>');
    const ms = archive.filter((m) => m.from === from && m.to === to);
    return { from, to, count: n, share_pct: Math.round((n / archive.length) * 1000) / 10, route_allowed: routeAllowed(from, to) ? 'yes' : 'NO', types: count(ms, (m) => m.type).map(([t, v]) => `${t}:${v}`).join(' ') };
  }));
writeCsv('by_priority.csv', ['priority', 'in_protocol', 'count'],
  count(archive, (m) => m.fm_priority || '(missing)').map(([priority, n]) => ({ priority, in_protocol: PROTOCOL_PRIORITIES.includes(priority) ? 'yes' : 'no', count: n })));

// per day (by sender-stated timestamp and by mtime)
const days = [...new Set(archive.flatMap((m) => [day(m.ts), day(m.ts_mtime)]))].filter(Boolean).sort();
const typesAll = count(archive, (m) => m.type).map(([t]) => t);
writeCsv('per_day.csv', ['day', 'msgs_by_name_ts', 'msgs_by_mtime', 'senders_active', 'top_types', 'tech_lead_out', 'tech_lead_in', 'p0'],
  days.map((d) => {
    const ms = archive.filter((m) => day(m.ts) === d);
    return { day: d, msgs_by_name_ts: ms.length, msgs_by_mtime: archive.filter((m) => day(m.ts_mtime) === d).length,
      senders_active: new Set(ms.map((m) => m.from)).size,
      top_types: count(ms, (m) => m.type).slice(0, 4).map(([t, v]) => `${t}:${v}`).join(' '),
      tech_lead_out: ms.filter((m) => m.from === 'TECH_LEAD').length, tech_lead_in: ms.filter((m) => m.to === 'TECH_LEAD').length,
      p0: ms.filter((m) => m.fm_priority === 'P0').length };
  }));
writeCsv('per_day_by_type.csv', ['day', ...typesAll], days.map((d) => {
  const row = { day: d };
  for (const t of typesAll) row[t] = archive.filter((m) => day(m.ts) === d && m.type === t).length;
  return row;
}));
writeCsv('per_day_by_sender.csv', ['day', ...AGENTS, 'FOUNDER'], days.map((d) => {
  const row = { day: d };
  for (const a of [...AGENTS, 'FOUNDER']) row[a] = archive.filter((m) => day(m.ts) === d && m.from === a).length;
  return row;
}));
writeCsv('per_hour_utc.csv', ['hour_utc', 'msgs_by_mtime', 'msgs_by_name_ts'], Array.from({ length: 24 }, (_, h) => ({
  hour_utc: h, msgs_by_mtime: archive.filter((m) => m.ts_mtime.getUTCHours() === h).length, msgs_by_name_ts: archive.filter((m) => m.ts_name && m.ts_name.getUTCHours() === h).length })));

// ---------- clock skew (file-name time vs disk time) ----------
writeCsv('clock_skew_by_sender.csv', ['sender', 'count', 'median_min', 'p10_min', 'p90_min', 'abs_over_60min', 'abs_over_1day', 'negative_over_5min'],
  AGENTS.concat('FOUNDER').map((a) => {
    const v = archive.filter((m) => m.from === a && m.skew_min !== null).map((m) => m.skew_min).sort((x, y) => x - y);
    return { sender: a, count: v.length, median_min: v.length ? Math.round(quantile(v, 0.5)) : '', p10_min: v.length ? Math.round(quantile(v, 0.1)) : '', p90_min: v.length ? Math.round(quantile(v, 0.9)) : '',
      abs_over_60min: v.filter((x) => Math.abs(x) > 60).length, abs_over_1day: v.filter((x) => Math.abs(x) > 1440).length, negative_over_5min: v.filter((x) => x < -5).length };
  }));
writeCsv('clock_skew_worst.csv', ['id', 'from', 'to', 'type', 'ts_name', 'ts_mtime', 'skew_min', 'fm_sent_utc', 'subject'],
  archive.filter((m) => m.skew_min !== null && Math.abs(m.skew_min) > 60).sort((a, b) => Math.abs(b.skew_min) - Math.abs(a.skew_min)).slice(0, 60)
    .map((m) => ({ id: m.id, from: m.from, to: m.to, type: m.type, ts_name: iso(m.ts_name), ts_mtime: iso(m.ts_mtime), skew_min: m.skew_min, fm_sent_utc: m.fm_sent_utc, subject: m.subject })));

// ---------- latency pairs ----------
const pairs = [];
function addPair(kind, orig, reply, how) {
  if (!orig || !reply || orig === reply) return;
  pairs.push({ kind, how, orig_id: orig.id, reply_id: reply.id, orig_from: orig.from, orig_to: orig.to, orig_type: orig.type, reply_type: reply.type,
    orig_priority: orig.fm_priority, lat_name_min: orig.ts_name && reply.ts_name ? minutes(reply.ts_name - orig.ts_name) : null,
    lat_mtime_min: minutes(reply.ts_mtime - orig.ts_mtime), role_pair: `${orig.from}>${orig.to}` });
}
const seenReply = new Set();
// (a) explicit reply_to links
for (const r of messages) for (const oid of r.reply_resolved) { const o = byId.get(oid); if (o && !seenReply.has(r.id + '|' + oid)) { seenReply.add(r.id + '|' + oid); addPair('reply_to', o, r, 'explicit'); } }
const repliedVia = new Set(pairs.map((p) => p.orig_id));
// (b) natural pairs for messages without an explicit reply pointing at them
const later = (o, pred) => messages.find((c) => c.ts > o.ts && pred(c));
const strongTokens = (m) => new Set([...m.ref_tokens].filter((t) => /^(T-|WP|BUG-|CR-|C\d|QA-)/.test(t)));
for (const o of messages) {
  if (repliedVia.has(o.id)) continue;
  const ot = strongTokens(o);
  if (o.type === 'TASK' && ot.size) {
    const r = later(o, (c) => (c.type === 'REPORT' || c.type === 'RPT') && c.from === o.to && c.to === o.from && intersects(ot, strongTokens(c)));
    if (r) addPair('TASK>REPORT', o, r, 'natural:ref');
  } else if ((o.type === 'REPORT' || o.type === 'RPT') && o.to === 'TECH_LEAD' && ot.size) {
    const r = later(o, (c) => c.type === 'VERDICT' && c.from === o.to && c.to === o.from && intersects(ot, strongTokens(c)));
    if (r) addPair('REPORT>VERDICT', o, r, 'natural:ref');
  } else if (o.type === 'QUESTION') {
    const r = later(o, (c) => c.type === 'ANSWER' && c.from === o.to && c.to === o.from && (ot.size ? intersects(ot, strongTokens(c)) : (c.ts - o.ts) < 24 * 3600000));
    if (r) addPair('QUESTION>ANSWER', o, r, ot.size ? 'natural:ref' : 'natural:next-24h');
  } else if (o.type === 'REQUEST' && ot.size) {
    const r = later(o, (c) => (c.type === 'REPORT' || c.type === 'RPT' || c.type === 'ANSWER') && c.from === o.to && c.to === o.from && intersects(ot, strongTokens(c)));
    if (r) addPair('REQUEST>REPORT/ANSWER', o, r, 'natural:ref');
  }
}
// explicit pairs by kind as well (so the write-up can quote TASK>REPORT including reply_to-linked ones)
for (const p of pairs.filter((p) => p.kind === 'reply_to')) {
  const k = `${p.orig_type}>${p.reply_type}`;
  if (['TASK>REPORT', 'TASK>RPT', 'REPORT>VERDICT', 'RPT>VERDICT', 'QUESTION>ANSWER', 'REQUEST>REPORT', 'REQUEST>RPT', 'REQUEST>ANSWER'].includes(k)) p.kind_detail = k.replace('RPT', 'REPORT');
  else p.kind_detail = 'other';
}
writeCsv('latency_pairs.csv', ['kind', 'kind_detail', 'how', 'orig_id', 'reply_id', 'orig_from', 'orig_to', 'orig_type', 'reply_type', 'orig_priority', 'lat_name_min', 'lat_mtime_min'],
  pairs.map((p) => ({ ...p, kind_detail: p.kind_detail ?? p.kind })));
function latencyRows(groupKey, label) {
  const groups = new Map();
  for (const p of pairs) { const k = groupKey(p); if (k === null) continue; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  return [...groups.entries()].map(([k, ps]) => {
    const byName = stats(ps.map((p) => p.lat_name_min).filter((x) => x !== null && x >= 0));
    const byM = stats(ps.map((p) => p.lat_mtime_min).filter((x) => x >= 0));
    return { [label]: k, pairs: ps.length, negative_by_name: ps.filter((p) => p.lat_name_min !== null && p.lat_name_min < 0).length, negative_by_mtime: ps.filter((p) => p.lat_mtime_min < 0).length,
      n_name: byName.count, median_name_min: byName.median ?? '', p90_name_min: byName.p90 ?? '', max_name_min: byName.max ?? '',
      n_mtime: byM.count, median_mtime_min: byM.median ?? '', p90_mtime_min: byM.p90 ?? '', max_mtime_min: byM.max ?? '' };
  }).sort((a, b) => b.pairs - a.pairs);
}
const LAT_COLS = ['pairs', 'negative_by_name', 'negative_by_mtime', 'n_name', 'median_name_min', 'p90_name_min', 'max_name_min', 'n_mtime', 'median_mtime_min', 'p90_mtime_min', 'max_mtime_min'];
writeCsv('latency_by_kind.csv', ['kind', ...LAT_COLS], latencyRows((p) => p.kind_detail ?? p.kind, 'kind'));
writeCsv('latency_by_type_pair.csv', ['type_pair', ...LAT_COLS], latencyRows((p) => `${p.orig_type}>${p.reply_type}`, 'type_pair'));
writeCsv('latency_by_role_pair.csv', ['role_pair', ...LAT_COLS], latencyRows((p) => p.role_pair, 'role_pair'));
writeCsv('latency_by_kind_and_role_pair.csv', ['kind_role', ...LAT_COLS], latencyRows((p) => `${p.kind_detail ?? p.kind} | ${p.role_pair}`, 'kind_role'));
writeCsv('latency_by_priority.csv', ['priority', ...LAT_COLS], latencyRows((p) => p.orig_priority || '(missing)', 'priority'));
writeCsv('latency_by_responder.csv', ['responder', ...LAT_COLS], latencyRows((p) => p.orig_to, 'responder'));
writeCsv('latency_all.csv', ['all', ...LAT_COLS], latencyRows(() => 'all', 'all'));
// needs_reply_by honoured?
const nrb = messages.filter((m) => !NONE_VALUES.has(String(m.fm_needs_reply_by).toLowerCase()));
writeCsv('needs_reply_by.csv', ['id', 'from', 'to', 'type', 'needs_reply_by', 'replied_by', 'reply_ts_name', 'on_time'],
  nrb.map((m) => {
    const p = pairs.find((p) => p.orig_id === m.id);
    const dl = new Date(String(m.fm_needs_reply_by).trim().replace(/Z?$/, 'Z'));
    const r = p ? byId.get(p.reply_id) : null;
    return { id: m.id, from: m.from, to: m.to, type: m.type, needs_reply_by: m.fm_needs_reply_by, replied_by: r ? r.id : '', reply_ts_name: r ? iso(r.ts_name) : '',
      on_time: r && !Number.isNaN(dl.getTime()) && r.ts_name ? (r.ts_name <= dl ? 'yes' : 'late') : (r ? 'unknown' : 'no reply found') };
  }));

// ---------- hub ----------
const tlOut = archive.filter((m) => m.from === 'TECH_LEAD');
const tlIn = archive.filter((m) => m.to === 'TECH_LEAD');
const tlTouch = archive.filter((m) => m.from === 'TECH_LEAD' || m.to === 'TECH_LEAD');
const step = Math.max(1, Math.floor(tlOut.length / 30));
const tlSample = tlOut.filter((_, i) => i % step === 0).slice(0, 30);
writeCsv('tl_sample_30.csv', ['n', 'id', 'to', 'type', 'reply_to', 'ref', 'subject', 'body_head'],
  tlSample.map((m, i) => ({ n: i + 1, id: m.id, to: m.to, type: m.type, reply_to: m.fm_reply_to, ref: m.fm_ref, subject: m.subject, body_head: m.body_head.slice(0, 400) })));
writeCsv('star_violations.csv', ['id', 'from', 'to', 'type', 'ts_name', 'fm_to', 'subject'],
  archive.filter((m) => !routeAllowed(m.from, m.to)).map((m) => ({ id: m.id, from: m.from, to: m.to, type: m.type, ts_name: iso(m.ts_name), fm_to: m.fm_to, subject: m.subject })));
writeCsv('broadcasts.csv', ['id', 'from', 'to_filename', 'fm_to', 'type', 'subject'],
  archive.filter((m) => m.fm_to === 'ALL' || m.to === 'ALL').map((m) => ({ id: m.id, from: m.from, to_filename: m.to, fm_to: m.fm_to, type: m.type, subject: m.subject })));

// ---------- protocol overhead: INFO ----------
const infos = archive.filter((m) => m.type === 'INFO');
for (const m of infos) [m.info_class, m.info_rule] = classifyInfo(m);
writeCsv('info_classified.csv', ['id', 'from', 'to', 'suffix', 'info_class', 'info_rule', 'keywords', 'body_words', 'subject'],
  infos.map((m) => ({ id: m.id, from: m.from, to: m.to, suffix: m.suffix, info_class: m.info_class, info_rule: m.info_rule, keywords: m.keywords.join(' '), body_words: m.body_words, subject: m.subject })));
writeCsv('info_by_class.csv', ['info_class', 'count', 'share_pct', 'top_senders', 'example_ids'],
  count(infos, (m) => m.info_class).map(([c, n]) => { const ms = infos.filter((m) => m.info_class === c); return { info_class: c, count: n, share_pct: Math.round((n / infos.length) * 1000) / 10,
    top_senders: count(ms, (m) => m.from).slice(0, 4).map(([k, v]) => `${k}:${v}`).join(' '), example_ids: ms.slice(0, 3).map((m) => m.id).join(' ') }; }));
writeCsv('info_by_top_class.csv', ['info_class', 'count', 'share_pct'],
  count(infos, (m) => INFO_TOP(m.info_class)).map(([c, n]) => ({ info_class: c, count: n, share_pct: Math.round((n / infos.length) * 1000) / 10 })));
writeCsv('info_by_class_and_sender.csv', ['sender', ...count(infos, (m) => INFO_TOP(m.info_class)).map(([c]) => c), 'total'],
  AGENTS.map((a) => { const row = { sender: a, total: infos.filter((m) => m.from === a).length }; for (const [c] of count(infos, (m) => INFO_TOP(m.info_class))) row[c] = infos.filter((m) => m.from === a && INFO_TOP(m.info_class) === c).length; return row; }));
{ // deterministic read sample of INFO messages for manual validation (every k-th by time)
  const k = Math.max(1, Math.floor(infos.length / 40));
  writeCsv('info_sample_40.csv', ['n', 'id', 'from', 'to', 'suffix', 'info_class', 'subject', 'body_head'],
    infos.filter((_, i) => i % k === 0).slice(0, 40).map((m, i) => ({ n: i + 1, id: m.id, from: m.from, to: m.to, suffix: m.suffix, info_class: m.info_class, subject: m.subject, body_head: m.body_head.slice(0, 350) })));
}
writeCsv('foreign_files.csv', ['file', 'bytes', 'mtime'], foreign);
writeCsv('by_fm_type.csv', ['fm_type', 'count'], count(archive, (m) => m.fm_type || '(missing)').map(([t, n]) => ({ fm_type: t, count: n })));
writeCsv('info_suffixes.csv', ['suffix_token', 'count'], count(infos.filter((m) => m.suffix), (m) => m.suffix.toLowerCase().split('_')[0]).map(([k, n]) => ({ suffix_token: k, count: n })));
// resend incidents: every message whose suffix or subject says resend, grouped by sender+hour
const resends = archive.filter((m) => /resend|re-send/i.test(m.suffix) || /resend|re-send|sent again|send it again|copy of my earlier/i.test(m.subject) || m.keywords.includes('resend') && m.type === 'INFO');
writeCsv('resend_messages.csv', ['id', 'ts_name', 'from', 'to', 'type', 'suffix', 'subject', 'body_head'],
  resends.map((m) => ({ id: m.id, ts_name: iso(m.ts_name), from: m.from, to: m.to, type: m.type, suffix: m.suffix, subject: m.subject, body_head: m.body_head.slice(0, 500) })));

// ---------- drift and errors ----------
writeCsv('type_drift.csv', ['type', 'count', 'first_seen', 'first_id', 'senders'],
  count(archive.concat(inbox), (m) => m.type).filter(([t]) => !PROTOCOL_TYPES.includes(t)).map(([t, n]) => { const ms = messages.filter((m) => m.type === t); return { type: t, count: n, first_seen: iso(ms[0].ts), first_id: ms[0].id, senders: count(ms, (m) => m.from).map(([k, v]) => `${k}:${v}`).join(' ') }; }));
writeCsv('fm_type_drift.csv', ['fm_type', 'count', 'first_seen', 'senders'],
  count(messages.filter((m) => m.fm_type && !PROTOCOL_TYPES.includes(m.fm_type)), (m) => m.fm_type).map(([t, n]) => { const ms = messages.filter((m) => m.fm_type === t); return { fm_type: t, count: n, first_seen: iso(ms[0].ts), senders: count(ms, (m) => m.from).map(([k, v]) => `${k}:${v}`).join(' ') }; }));
writeCsv('malformed_filenames.csv', ['id', 'flags', 'from', 'to', 'type', 'suffix'],
  messages.filter((m) => m.flags.length).map((m) => ({ id: m.id, flags: m.flags.join(' '), from: m.from, to: m.to, type: m.type, suffix: m.suffix })));
writeCsv('suffixed_filenames_by_sender.csv', ['sender', 'with_suffix', 'total', 'pct'],
  AGENTS.map((a) => { const ms = archive.filter((m) => m.from === a); const s = ms.filter((m) => m.suffix).length; return { sender: a, with_suffix: s, total: ms.length, pct: ms.length ? Math.round((s / ms.length) * 1000) / 10 : 0 }; }));
writeCsv('missing_fields.csv', ['field', 'missing_count', 'empty_count', 'missing_by_sender'],
  REQUIRED_FIELDS.concat('sent_utc').map((f) => {
    const miss = messages.filter((m) => f === 'sent_utc' ? !(m.fm_sent_utc) && m.has_front_matter : m.missing_fields.includes(f));
    return { field: f, missing_count: miss.length, empty_count: messages.filter((m) => m.empty_fields.includes(f)).length, missing_by_sender: count(miss, (m) => m.from).map(([k, v]) => `${k}:${v}`).join(' ') };
  }).concat([{ field: '(no front matter at all)', missing_count: messages.filter((m) => !m.has_front_matter).length, empty_count: '', missing_by_sender: count(messages.filter((m) => !m.has_front_matter), (m) => m.from).map(([k, v]) => `${k}:${v}`).join(' ') }]));
writeCsv('fm_mismatch.csv', ['id', 'fm_mismatch', 'from', 'fm_from', 'to', 'fm_to', 'type', 'fm_type'],
  messages.filter((m) => m.fm_mismatch.length).map((m) => ({ id: m.id, fm_mismatch: m.fm_mismatch.join(' '), from: m.from, fm_from: m.fm_from, to: m.to, fm_to: m.fm_to, type: m.type, fm_type: m.fm_type })));
writeCsv('dangling_reply_to.csv', ['id', 'from', 'to', 'type', 'reply_to_raw', 'dangling_tokens'],
  messages.filter((m) => m.reply_dangling.length).map((m) => ({ id: m.id, from: m.from, to: m.to, type: m.type, reply_to_raw: m.fm_reply_to, dangling_tokens: m.reply_dangling.join(' ') })));
writeCsv('fuzzy_reply_to.csv', ['id', 'from', 'fuzzy'], messages.filter((m) => m.reply_fuzzy.length).map((m) => ({ id: m.id, from: m.from, fuzzy: m.reply_fuzzy.join(' | ') })));

// ---------- blockers / P0 ----------
const blockish = archive.filter((m) => m.type === 'BLOCKER' || m.fm_priority === 'P0');
for (const m of blockish) m.blocker_class = classifyBlocker(m);
writeCsv('blockers_and_p0.csv', ['id', 'ts_name', 'ts_mtime', 'from', 'to', 'type', 'priority', 'blocker_class', 'keywords', 'subject', 'body_head'],
  blockish.map((m) => ({ id: m.id, ts_name: iso(m.ts_name), ts_mtime: iso(m.ts_mtime), from: m.from, to: m.to, type: m.type, priority: m.fm_priority, blocker_class: m.blocker_class, keywords: m.keywords.join(' '), subject: m.subject, body_head: m.body_head.slice(0, 400) })));
writeCsv('blockers_by_class.csv', ['blocker_class', 'blocker_type_count', 'p0_count', 'total', 'by_sender', 'example_ids'],
  count(blockish, (m) => m.blocker_class).map(([c, n]) => { const ms = blockish.filter((m) => m.blocker_class === c); return { blocker_class: c, blocker_type_count: ms.filter((m) => m.type === 'BLOCKER').length, p0_count: ms.filter((m) => m.fm_priority === 'P0').length, total: n,
    by_sender: count(ms, (m) => m.from).map(([k, v]) => `${k}:${v}`).join(' '), example_ids: ms.slice(0, 3).map((m) => m.id).join(' ') }; }));
writeCsv('p0_per_day.csv', ['day', 'p0_sent', 'p0_from_tech_lead', 'blockers'], days.map((d) => ({ day: d, p0_sent: blockish.filter((m) => day(m.ts) === d && m.fm_priority === 'P0').length,
  p0_from_tech_lead: blockish.filter((m) => day(m.ts) === d && m.fm_priority === 'P0' && m.from === 'TECH_LEAD').length, blockers: blockish.filter((m) => day(m.ts) === d && m.type === 'BLOCKER').length })));
writeCsv('keyword_hits.csv', ['keyword', 'count', 'by_sender', 'example_ids'],
  Object.keys(KEYWORDS).map((k) => { const ms = archive.filter((m) => m.keywords.includes(k)); return { keyword: k, count: ms.length, by_sender: count(ms, (m) => m.from).map(([a, v]) => `${a}:${v}`).join(' '), example_ids: ms.slice(0, 4).map((m) => m.id).join(' ') }; }));
writeCsv('liveness_messages.csv', ['id', 'ts_name', 'from', 'to', 'type', 'suffix', 'keywords', 'subject', 'body_head'],
  archive.filter((m) => ['nohistory', 'api_down', 'unresponsive', 'inbox_deleted', 'resend'].some((k) => m.keywords.includes(k)) || /restart|resend|nohistory|api_down|unresponsive|silent|offline|idle/i.test(m.suffix))
    .map((m) => ({ id: m.id, ts_name: iso(m.ts_name), from: m.from, to: m.to, type: m.type, suffix: m.suffix, keywords: m.keywords.join(' '), subject: m.subject, body_head: m.body_head.slice(0, 400) })));

// ---------- liveness: gaps per agent ----------
const gapRows = [], longest = [];
for (const a of AGENTS) {
  const ts = archive.filter((m) => m.from === a).map((m) => m.ts_mtime.getTime()).sort((x, y) => x - y);
  let maxGap = 0, maxFrom = null, maxTo = null;
  for (let i = 1; i < ts.length; i++) {
    const g = ts[i] - ts[i - 1];
    if (g >= 8 * 3600000) gapRows.push({ agent: a, gap_start: iso(new Date(ts[i - 1])), gap_end: iso(new Date(ts[i])), gap_hours: Math.round(g / 360000) / 10 });
    if (g > maxGap) { maxGap = g; maxFrom = ts[i - 1]; maxTo = ts[i]; }
  }
  const st = path.join(ROOT, 'status', a + '.md');
  let statusLast = '', statusText = '', statusMtime = '';
  if (fs.existsSync(st)) { statusText = fs.readFileSync(st, 'utf8'); statusMtime = iso(fs.statSync(st).mtime); const mm = statusText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z/); statusLast = mm ? mm[0] : ''; }
  longest.push({ agent: a, cadence_min: CADENCE_MIN[a], messages_sent: ts.length, first_sent: ts.length ? iso(new Date(ts[0])) : '', last_sent: ts.length ? iso(new Date(ts[ts.length - 1])) : '',
    longest_gap_hours: Math.round(maxGap / 360000) / 10, longest_gap_start: maxFrom ? iso(new Date(maxFrom)) : '', longest_gap_end: maxTo ? iso(new Date(maxTo)) : '',
    gaps_over_8h: gapRows.filter((g) => g.agent === a).length, status_last_check: statusLast, status_file_mtime: statusMtime, status_doing: statusText.replace(/\s+/g, ' ').slice(0, 300) });
}
writeCsv('gaps_over_8h.csv', ['agent', 'gap_start', 'gap_end', 'gap_hours'], gapRows.sort((x, y) => x.gap_start.localeCompare(y.gap_start)));
writeCsv('liveness_per_agent.csv', ['agent', 'cadence_min', 'messages_sent', 'first_sent', 'last_sent', 'longest_gap_hours', 'longest_gap_start', 'longest_gap_end', 'gaps_over_8h', 'status_last_check', 'status_file_mtime', 'status_doing'], longest);
// whole-team quiet periods (no message from anyone, by mtime) >= 6 h
const allTs = archive.map((m) => m.ts_mtime.getTime()).sort((x, y) => x - y);
const quiet = [];
for (let i = 1; i < allTs.length; i++) { const g = allTs[i] - allTs[i - 1]; if (g >= 6 * 3600000) quiet.push({ quiet_start: iso(new Date(allTs[i - 1])), quiet_end: iso(new Date(allTs[i])), hours: Math.round(g / 360000) / 10 }); }
writeCsv('team_quiet_periods.csv', ['quiet_start', 'quiet_end', 'hours'], quiet);

// ---------- inbox now ----------
writeCsv('inbox_pending.csv', ['inbox', 'id', 'from', 'type', 'priority', 'ts_name', 'ts_mtime', 'age_days_at_run', 'age_days_at_last_activity', 'subject'],
  inbox.map((m) => ({ inbox: m.subfolder, id: m.id, from: m.from, type: m.type, priority: m.fm_priority, ts_name: iso(m.ts_name), ts_mtime: iso(m.ts_mtime),
    age_days_at_run: Math.round(((RUN_AT - (m.ts_name ?? m.ts_mtime)) / 86400000) * 10) / 10,
    age_days_at_last_activity: Math.round(((new Date(allTs[allTs.length - 1]) - (m.ts_name ?? m.ts_mtime)) / 86400000) * 10) / 10, subject: m.subject })));

// ---------- summary ----------
const summary = {
  run_at_utc: iso(RUN_AT), root: ROOT.replace(/^[A-Za-z]:\\Users\\[^\\]+/, '<home>'),
  archive_messages: archive.length, inbox_pending: inbox.length, total_files: messages.length,
  archive_first_ts_name: iso(archive[0]?.ts_name), archive_last_ts_name: iso(archive[archive.length - 1]?.ts_name),
  archive_first_mtime: iso(new Date(allTs[0])), archive_last_mtime: iso(new Date(allTs[allTs.length - 1])),
  days_with_traffic: new Set(archive.map((m) => day(m.ts))).size,
  senders: Object.fromEntries(count(archive, (m) => m.from)), recipients: Object.fromEntries(count(archive, (m) => m.to)), types: Object.fromEntries(count(archive, (m) => m.type)),
  tech_lead: { sent: tlOut.length, received: tlIn.length, touched: tlTouch.length, touched_share_pct: Math.round((tlTouch.length / archive.length) * 1000) / 10, sent_share_pct: Math.round((tlOut.length / archive.length) * 1000) / 10 },
  star_violations: archive.filter((m) => !routeAllowed(m.from, m.to)).length,
  non_protocol_types: count(archive, (m) => m.type).filter(([t]) => !PROTOCOL_TYPES.includes(t)).reduce((a, [, n]) => a + n, 0),
  malformed_filenames: messages.filter((m) => m.flags.length).length,
  with_suffix: archive.filter((m) => m.suffix).length,
  reply_to_set: messages.filter((m) => m.reply_tokens.length).length, reply_to_resolved: messages.filter((m) => m.reply_resolved.length).length,
  reply_to_dangling: messages.filter((m) => m.reply_dangling.length).length, reply_to_fuzzy: messages.filter((m) => m.reply_fuzzy.length).length,
  latency_pairs: pairs.length, latency_pairs_explicit: pairs.filter((p) => p.how === 'explicit').length,
  info_total: infos.length, info_by_class: Object.fromEntries(count(infos, (m) => INFO_TOP(m.info_class))), info_other_subclasses: Object.fromEntries(count(infos.filter((m) => m.info_class.startsWith('other')), (m) => m.info_class)),
  blockers_and_p0_by_class: Object.fromEntries(count(blockish, (m) => m.blocker_class)), foreign_files: foreign.length,
  broadcast_copies: bcast.length, broadcast_events: bcastEvents.size, broadcast_copies_by_type: Object.fromEntries(count(bcast, (m) => m.type)),
  needs_reply_by_set: nrb.length,
  resend_messages: resends.length, blockers: archive.filter((m) => m.type === 'BLOCKER').length, p0: archive.filter((m) => m.fm_priority === 'P0').length,
  median_body_words: stats(archive.map((m) => m.body_words)).median, total_body_words: archive.reduce((a, m) => a + m.body_words, 0), total_bytes: archive.reduce((a, m) => a + m.bytes, 0),
  clock_skew_abs_over_60min: archive.filter((m) => m.skew_min !== null && Math.abs(m.skew_min) > 60).length,
  clock_skew_abs_over_1day: archive.filter((m) => m.skew_min !== null && Math.abs(m.skew_min) > 1440).length,
};
writeJson('summary.json', summary);
console.log(JSON.stringify(summary, null, 2));
console.log(`\nWrote ${fs.readdirSync(OUT).length} files to ${OUT}`);
