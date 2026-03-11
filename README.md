<div align="center">

<img src="https://raw.githubusercontent.com/chanjoongx/myofferagent/main/public/brand/logo.svg" alt="My Offer Agent" width="90" height="90" />

<br />
<br />

# My Offer Agent

**AI-Powered Career Agent** — From resume building to job matching,<br />powered by 6 specialized AI agents.

Built for the **2026 Global PBL 1st Hackathon** in Irvine, CA.

<br />

<a href="https://myofferagent.com">Website</a> · <a href="#getting-started">Getting Started</a>

<br />

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI_Agents_SDK-412991?style=flat-square&logo=openai&logoColor=white)
![Claude](https://img.shields.io/badge/Built_with_Claude-D97706?style=flat-square&logo=anthropic&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare_Pages-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)

</div>

<br />

<div align="center">
<img src="https://github.com/user-attachments/assets/f5f56d96-1bd5-45c2-8210-9de2dd1a2395" alt="My Offer Agent — Home" width="960" />
</div>

<br />

## About

**My Offer Agent** is a conversational career assistant where 6 specialized AI agents collaborate to help you land your next job.

Upload your resume, search for jobs, get ATS analysis, and generate tailored cover letters — all through a single chat interface. Each agent handles a specific domain and seamlessly hands off to the next when needed, powered by the [OpenAI Agents SDK](https://github.com/openai/openai-agents-js).

<br />

<div align="center">
<img src="https://github.com/user-attachments/assets/4cda15da-b8a6-4aa9-a318-588c62826550" alt="My Offer Agent — Chat Interface" width="960" />
</div>

<br />

## Architecture

<div align="center">
<img src="https://raw.githubusercontent.com/chanjoongx/myofferagent/main/public/brand/architecture.svg" alt="Agent Architecture" width="960" />
</div>

<br />

## Agents

| Agent | Description |
|:------|:------------|
| **Triage** | Analyzes user intent and routes to the appropriate specialist agent |
| **Resume Builder** | Builds an ATS-optimized resume step-by-step through conversation |
| **Resume Analyzer** | Scores your resume on a 100-point ATS compatibility scale with section-level feedback |
| **Job Scout** | Searches the web in real-time for matching job postings via web search tool |
| **Match Strategy** | Evaluates fit between your resume and a specific job description |
| **Application Writer** | Generates tailored cover letters and optimized resume variants |

<br />

## Key Features

**Agent System**
- 6-agent pipeline with automatic handoff via OpenAI Agents SDK
- Server-side regex pre-routing + LLM-based triage for fast intent detection
- Persistent conversation context across agent transitions

**Resume & Jobs**
- PDF resume upload with client-side text extraction
- ATS score visualization with section-by-section breakdown
- Real-time job search powered by OpenAI web search tool
- Resume export as Markdown or PDF

**Interface**
- Agent sidebar with visual pipeline status and click-to-switch
- Message copy, retry, and timestamp controls
- Dark / Light / System theme with auto-detection
- Korean / English i18n with runtime switching
- Reduced motion support for accessibility

<br />

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| Framework | Next.js 16 (App Router) |
| Agent SDK | @openai/agents (TypeScript) |
| LLM | GPT-4o / GPT-4o-mini |
| Styling | Tailwind CSS v4 (CSS-first `@theme` config) |
| Validation | Zod v4 |
| PDF Parsing | pdfjs-dist v4.9 (CDN, browser-only) |
| Deployment | Cloudflare Pages via @opennextjs/cloudflare |
| Compiler | React Compiler (babel-plugin) |

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
│   ├── page.tsx                # Landing page
│   ├── agent/page.tsx          # Chat interface
│   └── api/agent/route.ts      # Agent API endpoint + smart routing
├── lib/
│   ├── agents/
│   │   ├── definitions.ts      # 6 agent configs via Agent.create()
│   │   ├── tools.ts            # parseResume, atsScore, generateResume
│   │   ├── model-config.ts     # GPT model settings
│   │   └── constants.ts        # Agent name constants
│   ├── types.ts                # Shared TypeScript types
│   ├── i18n.ts                 # Translation dictionary (ko/en)
│   ├── i18n-context.tsx        # Language provider
│   └── theme-context.tsx       # Theme provider
└── components/
    ├── chat/                   # ChatInterface, MessageBubble, AgentStatusPanel
    ├── resume/                 # ResumeUploader, ATSScoreCard
    ├── jobs/                   # JobCard
    └── ui/                     # Toast
```

<br />

## Deploy

This project is configured for Cloudflare Pages with the OpenNext adapter.
See [`wrangler.toml`](wrangler.toml) and [`open-next.config.ts`](open-next.config.ts) for details.

```bash
npm run cf:build       # Build
npm run cf:preview     # Local preview
npm run cf:deploy      # Deploy
```

`OPENAI_API_KEY` must be set as an encrypted environment variable in your deployment platform.

<br />

## License

This project is licensed under the [MIT License](LICENSE).
