<div align="center">

<img src="https://raw.githubusercontent.com/chanjoongx/myofferagent/main/public/brand/logo.svg" alt="My Offer Agent logo" width="90" height="90" />

<br />
<br />

# My Offer Agent

**AI career agent for the US job hunt.** Six specialized agents cover resume building,
ATS analysis, live job search, match strategy, and cover letters in one chat.

Built for the **2026 Global PBL 1st Hackathon** in Irvine, CA · Live at [myofferagent.com](https://myofferagent.com)

Solo project · 6 AI agents

<a href="https://myofferagent.com">Website</a> · <a href="#getting-started">Getting Started</a>

<br />

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI_Agents_SDK-412991?style=flat-square&logo=openai&logoColor=white)
![Claude](https://img.shields.io/badge/Built_with_Claude-D97706?style=flat-square&logo=anthropic&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)

</div>

<br />

<div align="center">
<img src="https://raw.githubusercontent.com/chanjoongx/myofferagent/main/public/screenshots/home.png" alt="Landing page of My Offer Agent" width="960" />
</div>

<br />

## About

Job seekers juggle separate tools for resumes, job boards, ATS checks, and cover letters.
My Offer Agent puts those steps into one conversation. Six agents built on the
[OpenAI Agents SDK](https://github.com/openai/openai-agents-js) each own one domain and
hand off to the next when the conversation calls for it. Upload a resume PDF, get a
100-point ATS score, search live postings, and draft a tailored cover letter without
leaving the chat.

<br />

<div align="center">
<img src="https://raw.githubusercontent.com/chanjoongx/myofferagent/main/public/screenshots/chat_interface.png" alt="Chat interface with the agent sidebar and resume panel" width="960" />
</div>

<br />

## Demo

### Conversation and agent handoff

<div align="center">
<img src="https://raw.githubusercontent.com/chanjoongx/myofferagent/main/public/screenshots/chat_demo.png" alt="Chat demo: greeting, capabilities, and automatic handoff to Job Scout" width="960" />
</div>

> The Triage agent greets users, explains what the service can do, and hands off to the
> right specialist (here, Job Scout) as soon as it detects intent.

<br />

### ATS resume analysis

<div align="center">
<img src="https://raw.githubusercontent.com/chanjoongx/myofferagent/main/public/screenshots/resume_demo.png" alt="Resume demo: PDF upload, ATS scoring, and detailed feedback" width="960" />
</div>

> Upload a PDF resume and get a 100-point ATS compatibility score. 65 points are computed
> deterministically in code (format, structure, achievements, readability), 35 by the model
> (keywords, grammar), so the same resume gets the same score twice.

<br />

### Job search and match strategy

<div align="center">
<img src="https://raw.githubusercontent.com/chanjoongx/myofferagent/main/public/screenshots/job_demo_blurred.png" alt="Job demo: live web search results and a personalized match analysis" width="960" />
</div>

> Job Scout searches the live web, reports postings as cards (with visa sponsorship
> flagged), and Match Strategy compares your resume against the posting you pick.

<br />

## Architecture

<div align="center">
<img src="https://raw.githubusercontent.com/chanjoongx/myofferagent/main/public/brand/architecture.svg" alt="Agent architecture diagram" width="960" />
</div>

<br />

## Agents

| Agent | Description |
|:------|:------------|
| **Triage** | Reads intent and routes to the right specialist. Has no tools of its own |
| **Resume Builder** | Builds a resume conversationally; every answer is saved to the canonical document through patch tools |
| **Resume Analyzer** | Imports raw resume text and produces the 100-point ATS score |
| **Job Scout** | Live web search for postings, grounded in today's date; reports structured job cards with sponsorship status and the posting date as seen at the source |
| **Match Strategy** | Scores resume-to-posting fit: keyword gap, met and unmet skills, concrete edit suggestions |
| **Application Writer** | Writes a 250-400 word cover letter grounded only in what the resume actually says |

<br />

## Key Features

**Agent system**
- 6-agent pipeline with automatic handoff (OpenAI Agents SDK), SSE streaming from the first token
- First-turn regex pre-routing skips one LLM round trip when intent is unambiguous; the routing logic is unit-tested against known false positives
- Conversation continuity via OpenAI response chaining; the resume document itself is client-held, so the server stays stateless

**Resume**
- PDF text extraction runs entirely in the browser (pdfjs); the file never leaves the device, only extracted text is sent
- One canonical resume document (zod schema) shared by the agents, the ATS scorer, the live editor panel, and every exporter; limits clamp instead of reject, so partial data survives
- Server edits merge 3-way with whatever you typed in the editor while the answer was streaming
- Export as PDF (browser print engine, single-column ATS-safe layout), DOCX, Markdown, or JSON

**Security**
- Edge rate limiting with Cloudflare's native rate limiting binding (20 requests/min per IP, aggregated globally, not per-isolate)
- Prompt injection defenses: untrusted text is fenced with marker folding, ATS scoring runs in an isolated model call, and a code-level check rejects rewritten bullets that invent numbers
- Request caps enforced on real bytes: 1 MB body, 50 messages (48k chars in aggregate), 12k per message, 60k of resume text, 20 agent turns, 8 paid web searches, and a 5-minute run deadline
- Strict CSP with no external script or connect origins besides Cloudflare Analytics, plus HSTS and Cross-Origin-Opener-Policy; markdown images are never rendered (blocks zero-click data exfiltration)

**Interface**
- Agent sidebar with live pipeline status; completion checks appear only for agents that actually ran tools
- Korean / English at runtime, dark / light / system theme, both settled before first paint (no flash)
- Mobile resume panel is a real modal: focus trap, Escape, focus return, scroll lock
- IME-aware input: the Enter that commits Korean composition does not send the message

<br />

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| Framework | Next.js 16 (App Router, webpack build) + React 19 with React Compiler |
| Agent SDK | @openai/agents 0.6 (TypeScript) |
| LLM | gpt-5.5 (standard) / gpt-5.4-mini (reserved cost lever), overridable via `OPENAI_MODEL_STANDARD` / `OPENAI_MODEL_FAST` |
| Styling | Tailwind CSS v4 (CSS-first `@theme`, oklch palette) |
| Validation | Zod v4 |
| PDF parsing | pdfjs-dist 5.x, bundled locally and lazy-loaded in the browser (the CSP blocks CDNs) |
| Deployment | Cloudflare Workers via @opennextjs/cloudflare + Workers Builds |

<br />

## Verification

`npm run check` runs typecheck, 334 unit tests, and the production build. Because none of
that exercises the real Workers runtime, `scripts/verify/` adds four harnesses that run
against a real browser and a real workerd:

| Harness | What it proves |
|:--------|:---------------|
| `browser.mjs` | pdfjs loads from our origin (no CDN), CSP holds, a PDF made by our renderer round-trips through our parser, panel edits persist, multi-tab sync, IME Enter guard |
| `verify-a11y.mjs` | Pinch zoom allowed, theme and language settle before first paint, placeholder contrast is at least 4.5:1, the mobile panel behaves as a true modal |
| `verify-checkmarks.mjs` | Sidebar completion checks appear only for agents that actually did work |
| `e2e.mjs` | Full agent scenarios over live SSE: routing, tool calls, resume round-trip, English locale, prompt injection resistance |

```bash
npm run verify:local   # all four against a local workerd (cf:preview)
npm run verify:prod    # a11y + e2e against production (calls the real model, costs money)
```

<br />

## Getting Started

### Prerequisites

- Node.js 22+
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Setup

```bash
git clone https://github.com/chanjoongx/myofferagent.git
cd myofferagent
npm install
cp .env.example .env.local
```

Add your OpenAI API key to `.env.local`:

```
OPENAI_API_KEY=sk-proj-...
```

### Run

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

<br />

## Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Landing page
│   ├── agent/page.tsx            # Chat app shell
│   ├── api/agent/route.ts        # SSE endpoint: rate limit, input caps, abort propagation
│   └── robots.ts, sitemap.ts     # Crawler policy
├── lib/
│   ├── agents/
│   │   ├── definitions.ts        # 6 agents, per-locale instructions, handoff graph
│   │   ├── routing.ts, intent.ts # First-turn pre-routing (unit-tested)
│   │   ├── sanitize.ts           # Fencing for untrusted text, linear-time marker folding
│   │   ├── fabrication.ts        # Rejects invented numbers in bullet rewrites
│   │   ├── model-config.ts       # Model names, env-overridable
│   │   ├── openai-client.ts      # Timeouts, retries, schema-repair JSON calls
│   │   └── tools/                # Resume patch tools, ATS analysis, job/match reporting
│   ├── resume/
│   │   ├── schema.ts             # Canonical resume document (zod, clamp not reject)
│   │   ├── store.ts              # localStorage persistence + cross-tab sync
│   │   ├── ats.ts                # The deterministic 65 points of the ATS score
│   │   ├── export.ts             # PDF / DOCX / MD / JSON downloads
│   │   └── render/               # markdown.ts, print-html.ts, docx.ts
│   ├── rate-limit.ts             # Cloudflare rate limiting binding, in-memory fallback
│   ├── i18n.ts                   # ko/en dictionary (parity-tested)
│   └── types.ts                  # Shared API and domain types
├── components/
│   ├── chat/                     # ChatInterface, MessageBubble, AgentStatusPanel
│   ├── resume/                   # ResumePanel, EditableText, ATSScoreCard
│   ├── jobs/                     # JobCard
│   └── ui/                       # Toast
scripts/
└── verify/                       # Real-browser and workerd verification harnesses
```

<br />

## Deploy

Pushing to `main` deploys automatically: Cloudflare **Workers Builds** runs the OpenNext
build and publishes the worker, typically in 2 to 4 minutes. See
[`wrangler.toml`](wrangler.toml) and [`open-next.config.ts`](open-next.config.ts).

```bash
npm run cf:preview     # local workerd preview at http://localhost:8787
npm run cf:deploy      # manual deploy, emergency use only (bypasses Workers Builds)
```

`OPENAI_API_KEY` must be set as an encrypted variable on the worker
(`npx wrangler secret put OPENAI_API_KEY`).

<br />

## Documentation

| File | What it covers |
|:-----|:---------------|
| [`TECHNICAL.md`](TECHNICAL.md) | Full technical documentation: request lifecycle, agent and tool system, security model, deployment, verification |
| [`PROJECT.md`](PROJECT.md) | Architecture rules and specs that code changes must follow (reference for AI coding tools, Korean) |
| [`CLAUDE.md`](CLAUDE.md) | Session working rules: cost and deploy gates, environment pitfalls (Korean) |
| [`scripts/verify/README.md`](scripts/verify/README.md) | How to run the four verification harnesses (Korean) |

<br />

## License

This project is licensed under the [MIT License](LICENSE).
