# My Offer Agent, Technical Documentation

Last verified against the code on 2026-07-21. Where this document and the code
disagree, the code wins; update this file in the same commit as the change.

Companion documents: [`README.md`](README.md) is the public overview,
[`PROJECT.md`](PROJECT.md) holds the architecture rules code changes must follow
(Korean), [`CLAUDE.md`](CLAUDE.md) holds session working rules and environment
pitfalls (Korean), and [`scripts/verify/README.md`](scripts/verify/README.md)
explains the harnesses.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Agent System](#4-agent-system)
5. [API Specification](#5-api-specification)
6. [Tool System](#6-tool-system)
7. [Resume Pipeline](#7-resume-pipeline)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Deployment](#9-deployment)
10. [Security](#10-security)
11. [State Management](#11-state-management)
12. [Verification](#12-verification)
13. [Development Notes](#13-development-notes)
14. [Known Limitations and Future Work](#14-known-limitations-and-future-work)

---

## 1. Overview

My Offer Agent is a conversational career assistant for Korean students targeting
US jobs. Six agents built on the OpenAI Agents SDK share one canonical resume
document and hand off to each other inside a single chat.

### Key capabilities

- Conversational resume building; every user answer is persisted through patch tools
- 100-point ATS scoring: 65 points deterministic in code, 35 points model-judged
- Live job search through the SDK's hosted web search tool, with visa sponsorship flagged
- Resume-to-posting match analysis and grounded cover letter drafting
- Export as PDF (browser print engine), DOCX, Markdown, and JSON

---

## 2. Architecture

### High-level flow

```
Browser (React 19, localStorage resume)
  └─ POST /api/agent  (JSON in, SSE out)
       ├─ checkRateLimit()          Cloudflare rate limiting binding, 20 req/60s per IP
       ├─ byte-accurate body cap    1 MB measured on the received bytes
       ├─ message validation       max 50 messages, 12k chars each
       ├─ coerceResume()            client-held resumeDoc -> canonical document
       ├─ routeIntent()             first-turn regex pre-routing, else keep active agent
       └─ run(agent, items, { stream, maxTurns: 20, signal, previousResponseId? })
            └─ SSE events: agent | tool_start | tool_end | delta | resume | done | error
```

### Request lifecycle

1. The client sends the visible history (capped at 50 messages client-side too), the
   canonical `resumeDoc`, optional `resumeText` (freshly extracted from a PDF), the
   `lastResponseId` of the previous turn, and the active agent name.
2. The server never stores anything. It reconstructs execution context per request:
   `createContext({ resume, locale, signal })`.
3. If `lastResponseId` is present, only the newest user message is sent to the model;
   prior context lives server-side at OpenAI under that response chain. Otherwise the
   full role-preserving history is sent.
4. `resumeText` is wrapped with `fence('RESUME_TEXT', ...)` before joining the prompt.
5. The run streams. Client aborts (stop button, tab close) propagate through an
   `AbortController` into the SDK run and into every tool's own OpenAI call.
6. `done` carries the final payload: output text, active agent, `completedAgents`
   (only agents that ran non-read-only tools), all structured data emitted by tools,
   the patched `resumeDoc` if it changed, and the new `lastResponseId`.

### Handoff graph

```
Triage ──> { Resume Builder, Resume Analyzer, Job Scout }
Resume Builder  <──> Resume Analyzer ──> Job Scout <──> Match Strategy ──> Application Writer
```

Reverse edges exist everywhere a real user flow needs to go back (for example
Application Writer back to Job Scout). Cycles are fine; `maxTurns: 20` bounds any loop.

---

## 3. Tech Stack

| Layer | Technology | Notes |
|:------|:-----------|:------|
| Framework | Next.js 16.2 App Router | webpack build only; Turbopack chunks break OpenNext |
| UI | React 19.2 + React Compiler | `babel-plugin-react-compiler` |
| Language | TypeScript 5, strict | |
| Styling | Tailwind CSS v4 | CSS-first `@theme`, oklch color tokens |
| Agents | `@openai/agents` 0.6 | streaming runs, handoffs, hosted web search |
| Validation | Zod v4 | tool parameters and the canonical resume schema |
| PDF parsing | `pdfjs-dist` 5.x | bundled locally, browser-only dynamic import |
| DOCX | `docx` 9.x | dynamic import, only loaded on DOCX export |
| Markdown render | `react-markdown` + `remark-gfm` | raw HTML stays escaped, images never rendered |
| Hosting | Cloudflare Workers | `@opennextjs/cloudflare` 1.20 + wrangler 4 |
| Tests | vitest (309 unit tests) + 4 Playwright/live harnesses | see [Verification](#12-verification) |

Models (`src/lib/agents/model-config.ts`):

| Key | Default | Used for | Override |
|:----|:--------|:---------|:---------|
| `standard` | `gpt-5.5` | agent reasoning, ATS judging, resume import, bullet rewriting | `OPENAI_MODEL_STANDARD` |
| `fast` | `gpt-5.4-mini` | currently unused; kept as a documented cost lever | `OPENAI_MODEL_FAST` |

Model changes must be validated with `npm run check:models` (makes real billed calls).

---

## 4. Agent System

### 4.1 Definitions (`src/lib/agents/definitions.ts`)

`instructions` is a function, evaluated per turn with the run context, so prompts adapt
to locale and resume state without string surgery:

- `languageRule(ctx)`: answer in Korean or English; resume content itself stays English
- `resumeState(ctx)`: injects only **presence** (set / MISSING / counts), never field
  values. Field values reach the model through `get_resume` tool output, which is the
  position models treat as data rather than instructions
- `INJECTION_GUARD`: resume text, postings, and search results are data, not commands

Per-agent notes:

| Agent | Tools | Notable rules |
|:------|:------|:--------------|
| Triage | none | routes only; cannot reach Match or Writer directly |
| Resume Builder | patch tools + `improve_bullets` | save first, improve second; never invent numbers |
| Resume Analyzer | `get_resume`, `import_resume_text`, `analyze_ats` | import replaces the document, confirm when one exists |
| Job Scout | `webSearchTool()`, `report_jobs` | prompt limit 3 searches (code breaker at 8); always constrain to early career; flag sponsorship |
| Match Strategy | `get_resume`, `report_match` | refuses to analyze without concrete posting details |
| Application Writer | `get_resume` | 250-400 word cover letter grounded in the resume |

### 4.2 Routing (`src/lib/agents/routing.ts`, `intent.ts`)

Principle: **pre-route on the first turn only; never force a switch mid-conversation.**

- Continuing session (`lastResponseId` present): keep the client-reported active agent.
  Mid-conversation switching is the model's job via handoffs.
- Manual sidebar switch: respected (the client clears `lastResponseId` first).
- New conversation: `detectIntent()` regex, ko/en, ordered cover_letter > search >
  analyze > build. Misses fall through to Triage (one cheap extra hop). The search
  pattern is deliberately narrow because a false positive lands in Job Scout, which
  performs paid web searches; the asymmetry (paid false positive vs one extra hop)
  is pinned by unit tests in `routing.test.ts`.

Why mid-conversation forced switching was removed: chained conversations replay prior
tool-call records server-side. If a different agent resumes the same chain and the model
re-calls a tool the new agent does not own, the SDK aborts the run with
`Tool ... not found in agent ...` (ModelBehaviorError). Not switching the chain owner
avoids the entire class.

### 4.3 Conversation state

- The OpenAI response chain (`previousResponseId`) is the conversation memory.
  OpenAI retains stored responses for about 30 days; a chain older than that cannot be
  resumed, and the client then falls back to sending visible history.
- The client intentionally clears the chain on **stop** and on **stream error**: an
  aborted turn is visible on screen but absent from the chain, and continuing the chain
  would silently drop that exchange from the model's memory. Clearing forces the next
  turn to send the full visible history, so what the user sees is what the model knows.
- Locale switching aborts any in-flight stream before resetting the conversation, so a
  late `done` cannot resurrect the old chain id into the fresh session.

---

## 5. API Specification

### `POST /api/agent`

Request body:

```ts
{
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionId: string;          // logging only
  resumeText?: string;        // fresh PDF extraction, >= 50 chars to count
  resumeDoc?: ResumeDocument; // canonical document, round-trips every turn
  lastResponseId?: string;    // OpenAI response chain
  activeAgentName?: string;
  language?: 'ko' | 'en';
}
```

Response: `text/event-stream`. Every frame is `data: <JSON>\n\n` with one of:

| Event | Payload | Meaning |
|:------|:--------|:--------|
| `agent` | `{ name }` | active agent changed (includes handoffs) |
| `tool_start` / `tool_end` | `{ tool }` | tool execution progress |
| `delta` | `{ text }` | streamed answer text |
| `resume` | `{ doc }` | resume changes, sent separately **before** `error` so edits survive failures |
| `done` | `{ payload: AgentResponse }` | terminal success |
| `error` | `{ message }` | terminal failure (also used for pre-stream 4xx/5xx bodies) |

`AgentResponse.structuredData` is an array because one run can emit several artifacts
(job results and a match analysis in the same run after a handoff).

### Server limits (all enforced in code, `route.ts`)

| Limit | Value |
|:------|:------|
| Body size | 1,000,000 bytes, measured on received bytes (not the content-length header) |
| Messages | last 50, each capped at 12,000 chars |
| Resume text | 60,000 chars, minimum 50 to be treated as a resume |
| Agent turns | `maxTurns: 20` |
| Web searches | 8 per request; exceeding aborts the run (cost circuit breaker; a single model response was measured bursting to 6, and hosted-tool calls inside one response cannot be interrupted anyway, so the breaker targets cross-turn loops) |
| Rate | 20 requests / 60s per IP at the edge |

---

## 6. Tool System

All tools live in `src/lib/agents/tools/` behind `import 'server-only'`. Tools receive
the shared `AppContext` (canonical resume, locale, abort signal, `emitted` slots) and
return compact JSON snapshots, never the whole document.

### Resume patch tools (`resume-tools.ts`)

`get_resume`, `set_basics`, `upsert_education`, `upsert_experience`, `upsert_project`,
`set_skills`, `remove_entry`.

- Patch semantics: empty string means "leave unchanged"; the sentinel `__CLEAR__`
  means "clear this field" (strict tool schemas force every field to be present, so a
  second in-band signal is required to distinguish the two).
- List items carry stable 8-char ids so the model can edit one entry without
  re-serializing the document.
- Every mutation passes through `coerceResume()`, which clamps rather than rejects.

### `improve_bullets`

Rewrites bullets with a `standard`-model JSON call (`callJson`). A code-level check
(`fabrication.ts`) compares number tokens in the rewrite against the original plus the
provided context; any rewrite that introduces a number the user never stated is
replaced with the original and an explanation. The model is not trusted on this rule.

### `import_resume_text` (`analysis-tools.ts`)

Structures raw resume text into the canonical document with one `standard`-model call.
The text is fenced (`fence('RESUME_TEXT', ...)`). Korean source resumes are translated
to professional English, and fields that are illegal on US resumes (photo, birth date,
gender, marital status) are dropped at the prompt level.

### `analyze_ats`

Hybrid scoring:

| Section | Points | Method |
|:--------|:-------|:-------|
| formatCompatibility | 20 | code (`scoreRules`) |
| structuralCompleteness | 15 | code |
| achievementQuality | 20 | code (quantified-achievement and verb-strength detection) |
| readability | 10 | code |
| keywordOptimization | 25 | model |
| grammar | 10 | model |

The model part runs as an **isolated** sub-call: the resume plain text is fenced
(`fence('RESUME', toPlainText(doc), { maxLength: 60_000 })`) and scored outside the
agent conversation. A hostile resume can therefore at most skew its own 35 model-judged
points; it cannot steer the agent's tools or conversation. That isolation is why the
tool structure stays this way even though inlining would save a round trip.
`combineScores()` sums the six sections, so `overallScore` is always the literal sum.

### `report_jobs` / `report_match`

Structured reporting is explicit: tools write to `ctx.emitted`, the route serializes
`ctx.emitted` into `done.structuredData`, and the client renders cards from it. There
is no output-string sniffing. `report_jobs` validates every URL with `isSafeUrl()`
(absolute http/https only) and counts no-sponsorship postings so the agent must
mention them.

### `web_search`

The SDK's hosted tool. Costs real money per call. Bounded by prompt (3) and by the
route-level circuit breaker (8 per request, then the run is aborted and the user gets
the standard error; resume changes still round-trip via the `resume` event). Hosted
calls execute inside the model's response, so the breaker cannot undo a burst within
one response; its job is to stop search loops that span turns.

### Shared client (`openai-client.ts`)

`callText` / `callJson`: 45s timeout per attempt (`AbortSignal.any` with the caller's
signal), up to 2 retries on 429/5xx honoring `Retry-After` with jitter, allowlisted
parameter self-repair (`temperature`, `max_completion_tokens`, `response_format` only),
and one schema-repair retry where the Zod issues are appended to the prompt.

---

## 7. Resume Pipeline

The canonical document (`src/lib/resume/schema.ts`) is the single source of truth for
agents, the ATS scorer, the editor panel, and every exporter.

- **Never fails.** All fields default; limits clamp instead of reject (a rejected parse
  used to wipe the whole resume including its localStorage copy).
- **Control characters are stripped** at the schema boundary (C0 except tab/newline,
  DEL, C1, zero-width space, bidi controls, BOM). PDF extraction leaks form feeds that
  would otherwise make the exported DOCX invalid XML, and bidi overrides could reorder
  the visible text of an exported resume.
- **Ids everywhere** so patches address one item.
- **3-way merge** (`threeWayMerge`): while a 20-40s turn streams, the user can keep
  editing the panel. Server results merge with base = document at send time; fields
  the user changed win, deletions stay deleted, additions survive.
- **Renderers** (`render/`): `markdown.ts` (minimal escaping, URL percent-encoding so
  parens/spaces cannot break the link syntax), `print-html.ts` (every value HTML-escaped,
  `javascript:` hrefs dropped, single-column ATS-safe layout, browser-print to PDF),
  `docx.ts` (tab-stop date alignment, explicit US Letter sizing).
- **Store** (`store.ts`): module-level external store consumed via
  `useSyncExternalStore` (separate server/client snapshots, no hydration mismatch),
  debounced 400ms localStorage writes, **cross-tab sync** via the `storage` event
  (last writer wins, both tabs converge), and a `pagehide` flush so closing the tab
  inside the debounce window does not lose the last edit.

---

## 8. Frontend Architecture

### ChatInterface

- SSE consumed by `agent-client.ts` (manual fetch parsing; frames can split across
  chunks; a stream that ends without `done`/`error` surfaces as `STREAM_TRUNCATED`).
- Streaming deltas buffer in a ref and flush once per animation frame; the streaming
  bubble is addressed **by id**, not by array position (handoffs insert system
  messages mid-stream).
- Send history is capped at 50 messages to mirror the server and avoid the 1 MB body
  limit in long sessions.
- Enter-to-send is IME-aware: `isComposing` / `keyCode 229` events are ignored so the
  Enter that commits Korean composition does not fire the message.
- Retry replays the exact previous send (text, attached resume text, file name) after
  slicing off the failed exchange.
- Stop aborts the fetch; the server's `ReadableStream.cancel` aborts the run and the
  tools' OpenAI calls. Stop and stream errors clear `lastResponseId` (see 4.3).

### MessageBubble

`react-markdown` + GFM with a hard rule set: raw HTML stays escaped, links render only
when `isSafeUrl()` passes (with `rel="noopener noreferrer"`), and images are **never**
rendered, only their alt text. A markdown image would let a prompt-injected reply
exfiltrate resume PII with zero clicks (React 19 even preloads image URLs before
paint); the CSP `img-src` is the second layer of the same defense.

### Accessibility

- The mobile resume panel is a true modal (`useModalOverlay`): dialog semantics, focus
  trap, Escape to close (unless typing in a field), focus return, scroll lock. On
  desktop it is a plain column and none of that applies.
- Theme and locale settle **before first paint** via a blocking inline script in
  `layout.tsx` head; React then hydrates against matching values
  (`useSyncExternalStore` with distinct server snapshots).
- Pinch zoom is never blocked; placeholder contrast is held at 4.5:1 and verified in a
  real browser by painting computed oklch colors to a canvas and reading sRGB pixels.

---

## 9. Deployment

### Platform: Cloudflare Workers

`@opennextjs/cloudflare` adapts the Next.js build to a worker. **Pushing to `main`
auto-deploys** through Cloudflare Workers Builds (typically 2-4 minutes).
`npm run cf:deploy` exists for emergencies only; using it alongside Workers Builds
double-deploys.

The Workers Builds build command must stay **`npm run cf:build`** (not the raw
`npx @opennextjs/cloudflare build`): the wrapper stashes `.env.local` during the
build and then fails the build if any secret-shaped value is baked into the
generated `next-env.mjs`. That scan is the deploy-time guard against shipping a
key inside the bundle. The build environment holds no secrets (the runtime key
lives only in the worker's own secret store), and a failed build leaves the
previous deployment serving, silently; check the Builds dashboard or API when a
push does not go live.

`wrangler.toml`:

- `nodejs_compat` flag, assets binding for static files
- `RATE_LIMITER` unsafe binding (`ratelimit`, 20 per 60s) consumed by
  `src/lib/rate-limit.ts`

Secrets: `npx wrangler secret put OPENAI_API_KEY` (plus optional model overrides).
The key never reaches any client bundle (`server-only` imports guard every module
that touches it).

### workerd polyfill

`route.ts` patches `AsyncLocalStorage.prototype.enterWith` to a no-op **only when the
runtime actually throws on it** (workerd does, Node does not). Patching unconditionally
breaks `next build` page data collection, which is a build failure that looks entirely
unrelated (`Invariant: Expected workUnitAsyncStorage to have a store`).

### Local verification against real workerd

`npm run check` does not execute workerd at all; a production incident once shipped
through exactly that gap. Before any push:

```bash
npm run cf:preview      # cf:build + wrangler dev on http://localhost:8787
npm run verify:local    # all four harnesses against it
```

---

## 10. Security

### API key

The key exists only in Worker secrets and `.env.local`. Modules touching it import
`server-only`, so a client-bundle import fails the build.

### Rate limiting

Cloudflare's native rate limiting binding, aggregated at the edge (20 requests/60s per
IP). The previous in-memory Map was useless on Workers because each isolate kept its
own counters. Without the binding (local dev, other hosts) the code degrades to the
in-memory window and logs that it did. The limiter failing never takes the API down;
errors fall through to the fallback.

### Input validation

- Body capped at 1 MB measured on actual received bytes (chunked requests have no
  content-length header to trust)
- Message array validated element-wise, roles normalized, 50/12k caps applied
- `resumeDoc` passes through `coerceResume` (clamp, strip control chars, never throw)
- `language` allowlisted; unknown agent names fall back to Triage via `Object.hasOwn`
  lookup (prototype names like `__proto__` cannot resolve to agents)

### Prompt injection

- Untrusted text (resume uploads, ATS scan text) is fenced; `scrub()` folds runs of
  3+ angle brackets so a closing marker cannot be forged inside data, in linear time
  (the previous regex was quadratic and 60k input burned 8s of Worker CPU)
- `analyze_ats` scores in an isolated sub-call, bounding a successful injection to the
  35 model-judged points (regression-tested in `analysis-tools.test.ts`)
- Instructions carry an explicit data-handling guard; imperative boilerplate like
  "ignore previous instructions" is visibly neutralized inside fenced data
- `improve_bullets` rejects invented numbers in code, not by trusting the prompt

### Output safety

- Print HTML escapes every value and drops non-http(s)/mailto hrefs; the print iframe
  runs sandboxed without `allow-scripts`
- Chat markdown never renders images and validates link URLs
- CSP: `default-src 'self'`; scripts/styles self + inline (Next bootstrap); images
  self/data/blob only; connect limited to self + Cloudflare Analytics;
  `frame-ancestors 'none'`

### Cost controls

- Paid web search: prompt-limited to 3, hard-aborted at 8 per request
- `maxTurns: 20`, all size caps above, and per-IP rate limiting bound the worst case
- Sub-calls carry the request abort signal, so a user stop actually stops billing

### Log hygiene

Stream errors log `err.name` plus a 300-char message slice, never the full error
object, because SDK errors can embed request fragments including resume content.

---

## 11. State Management

No database. State lives in exactly three places:

| State | Where | Notes |
|:------|:------|:------|
| Resume document | browser localStorage (`moa.resume.v1`) | debounced writes, cross-tab sync, explicit delete button (PII on shared machines) |
| Conversation | OpenAI response chain via `previousResponseId` | server-side at OpenAI, about 30 days retention; cleared client-side on stop/error/locale switch |
| Preferences | localStorage (`theme`, `locale`) | read pre-paint by the inline script |

The server reconstructs everything per request from the body. This is what lets the
worker scale to zero and deploy with no migrations.

---

## 12. Verification

Baseline as of 2026-07-21:

| Layer | Command | Count |
|:------|:--------|:------|
| Types + unit + build | `npm run check` | 309 vitest tests |
| Real browser vs workerd | `node scripts/verify/browser.mjs <url> scripts/verify` | 16 checks (pdfjs origin, CSP, PDF round-trip, panel edit persistence, multi-tab sync, IME guard) |
| Accessibility | `node scripts/verify/verify-a11y.mjs <url>` | 21 checks |
| Sidebar completion truthfulness | `node scripts/verify/verify-checkmarks.mjs <url>` | 7 checks, calls the real model |
| Agent E2E | `node scripts/verify/e2e.mjs <url> all` | 33 checks across 5 scenarios, calls the real model |

`verify:local` runs all four against `cf:preview`; `verify:prod` runs the a11y and e2e
passes against production. The model-calling harnesses bill the real OpenAI key: run
the full production e2e once per release, and iterate on single scenarios
(`node scripts/verify/e2e.mjs <url> analyzer`) while debugging.

---

## 13. Development Notes

- **webpack only.** `next build --webpack` everywhere; Turbopack chunk output is
  incompatible with the OpenNext adapter.
- **Stray workerd processes** survive their parent wrangler on Windows and hold locks
  that produce `.open-next` EPERM build failures. `Get-Process workerd` then
  `Stop-Process -Name workerd -Force` before building.
- **Killing document listeners:** Next App Router hydrates with
  `hydrateRoot(document)`, so React's own listeners sit on `document`;
  `stopPropagation` cannot shield them from sibling document listeners. Global key
  handlers must branch on `e.target` (see `useModalOverlay`).
- **Color math:** computed styles come back as `oklch(...)`. To measure contrast,
  paint to a 1x1 canvas and read the sRGB pixel; never parse the string.
- **PowerShell 5.1** has no `&&`; scripts here are invoked through npm (cmd) or Git
  Bash.
- `npm run check:models` verifies configured model names with real inference calls;
  run it only when changing models.

---

## 14. Known Limitations and Future Work

### Current limitations

- **No accounts.** The resume lives only in the browser's localStorage; clearing site
  data or switching devices loses it (JSON export is the manual backup path).
- **Conversation retention is OpenAI's.** Chained context expires roughly 30 days
  after the last response; the app then continues from the visible history only.
- **Rate limiting is per-IP.** Users behind one NAT share a 20/min budget, and a
  distributed attacker is bounded per IP, not globally; there is no per-user budget
  without accounts.
- **Sessions are device-local and single-conversation.** A new conversation discards
  the old one apart from the resume document.
- **ko/en only**, and resume conventions are US-market specific by design.
- **Search quality depends on the hosted web search tool**; there is no custom job
  board integration.
- The site is intentionally `noindex` (robots disallow all but LinkedInBot) while it
  remains a portfolio deployment; `sitemap.ts` exists for when indexing opens.

### Planned improvements (not scheduled)

- Accounts with server-side resume and conversation storage
- Multiple saved resumes and target-role variants
- Job board API integrations alongside web search
- Additional locales
