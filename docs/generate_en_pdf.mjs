import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
* {
    font-family: 'Segoe UI', 'Noto Sans', sans-serif;
}
body {
    font-size: 11pt;
    line-height: 1.6;
    color: #1F2937;
    max-width: 800px;
    margin: 0 auto;
    padding: 40px;
}
h1 {
    color: #0F766E;
    font-size: 24pt;
    border-bottom: 2px solid #14B8A6;
    padding-bottom: 10px;
    margin-top: 40px;
}
h2 {
    color: #1F2937;
    font-size: 16pt;
    margin-top: 30px;
}
h3 {
    color: #4B5563;
    font-size: 13pt;
}
table {
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
    font-size: 10pt;
}
th {
    background: #0F766E;
    color: white;
    padding: 10px;
    text-align: left;
}
td {
    padding: 8px 10px;
    border-bottom: 1px solid #E5E7EB;
}
tr:nth-child(even) {
    background: #F9FAFB;
}
code {
    background: #F3F4F6;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Consolas', monospace;
    font-size: 10pt;
}
pre {
    background: #1E293B;
    color: #E2E8F0;
    padding: 15px;
    border-radius: 8px;
    overflow-x: auto;
    font-size: 9pt;
    font-family: 'Consolas', monospace;
}
.cover {
    text-align: center;
    padding: 100px 0;
}
.cover h1 {
    font-size: 36pt;
    border: none;
    color: #1F2937;
}
.cover .subtitle {
    font-size: 18pt;
    color: #6B7280;
    margin-top: 10px;
}
.cover .version {
    margin-top: 50px;
    color: #9CA3AF;
}
.info-table {
    max-width: 500px;
    margin: 40px auto;
}
.page-break {
    page-break-after: always;
}
/* Prevent awkward page breaks */
table, pre, .pipeline {
    page-break-inside: avoid;
}
h1, h2, h3 {
    page-break-after: avoid;
}
p, li {
    orphans: 3;
    widows: 3;
}
ul {
    padding-left: 20px;
}
li {
    margin: 5px 0;
}
.footer {
    text-align: center;
    color: #9CA3AF;
    font-size: 10pt;
    margin-top: 50px;
    padding-top: 20px;
    border-top: 1px solid #E5E7EB;
}
.pipeline {
    text-align: center;
    margin: 20px 0;
    font-size: 11pt;
    color: #4B5563;
    letter-spacing: 1px;
}
.pipeline .agent {
    display: inline-block;
    background: #F0FDFA;
    border: 1px solid #99F6E4;
    border-radius: 8px;
    padding: 6px 14px;
    margin: 0 4px;
    font-weight: 600;
    color: #0F766E;
}
.pipeline .arrow {
    color: #9CA3AF;
    margin: 0 2px;
}
</style>
</head>
<body>

<!-- ==================== COVER ==================== -->
<div class="cover">
<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBmaWxsPSJub25lIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzBmNzY2ZSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMxNGI4YTYiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImJvbHQiIHgxPSIwLjMiIHkxPSIwIiB4Mj0iMC43IiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNmZmZmZmYiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZjBmZGZhIi8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcng9IjEwOCIgZmlsbD0idXJsKCNiZykiLz4KICA8cGF0aCBkPSJNMjgwIDk2TDE2OCAyODhoNzJsLTI0IDEyOCAxMTItMTkyaC03MkwyODAgOTZ6IiBmaWxsPSJ1cmwoI2JvbHQpIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K" width="80" style="margin-bottom: 20px;" />
<h1>My Offer Agent</h1>
<div class="subtitle">AI-Powered Career Pipeline</div>
<p style="margin-top: 30px;">Technical Guide &amp; Project Documentation</p>
<p style="margin-top: 20px; font-size: 12pt; color: #4B5563;">Chanjoong Kim</p>
<p style="font-size: 10pt; color: #6B7280;">chanjoongx@gmail.com</p>
<div class="version">Version 1.0.0 | March 2026</div>

<table class="info-table" style="margin-top: 60px;">
<tr><th colspan="2" style="text-align: center;">Project Information</th></tr>
<tr><td><strong>Live Demo</strong></td><td>myofferagent.com</td></tr>
<tr><td><strong>Tech Stack</strong></td><td>Next.js 16.1.6, OpenAI Agents SDK, Tailwind CSS v4</td></tr>
<tr><td><strong>Deployment</strong></td><td>Cloudflare Pages</td></tr>
<tr><td><strong>License</strong></td><td>MIT</td></tr>
</table>
</div>

<div class="page-break"></div>

<!-- ==================== TABLE OF CONTENTS ==================== -->
<h1>Table of Contents</h1>
<ol>
<li>Project Overview</li>
<li>Core Features</li>
<li>Agent Architecture</li>
<li>Tool Definitions</li>
<li>API Design</li>
<li>Technical Architecture</li>
<li>ATS Scoring System</li>
<li>Deployment</li>
<li>Internationalization</li>
</ol>

<div class="page-break"></div>

<!-- ==================== 1. PROJECT OVERVIEW ==================== -->
<h1>1. Project Overview</h1>

<h2>What is My Offer Agent?</h2>
<p>My Offer Agent is a conversational AI platform that helps job seekers manage their entire application process &mdash; from building resumes, to searching for jobs, to preparing tailored application materials &mdash; all through a single chat interface powered by six specialized AI agents.</p>

<p><strong>Key capabilities:</strong></p>
<ul>
<li>Six specialized AI agents with automatic handoff between them</li>
<li>Real-time job search powered by web search APIs</li>
<li>ATS (Applicant Tracking System) resume scoring with 100-point breakdown</li>
<li>Tailored cover letter and resume generation for specific job postings</li>
<li>Client-side PDF resume parsing &mdash; no data sent to third-party services</li>
</ul>

<h2>Problem Statement</h2>
<p>Job seekers today must juggle multiple disconnected tools: resume builders, job boards, ATS checkers, cover letter generators, and career advisors. Each tool has its own interface, data format, and learning curve. This fragmentation wastes time and creates gaps in the application strategy.</p>

<p>My Offer Agent consolidates the entire workflow into one conversational interface where users simply describe what they need, and the system automatically routes to the right specialist agent.</p>

<h2>Target Users</h2>
<ul>
<li>Job seekers preparing applications for multiple positions</li>
<li>Students entering the job market for the first time</li>
<li>Career changers who need resume optimization for a new field</li>
<li>International applicants who need help with English-language resumes</li>
</ul>

<div class="page-break"></div>

<!-- ==================== 2. CORE FEATURES ==================== -->
<h1>2. Core Features</h1>

<table>
<tr><th>Feature</th><th>Description</th></tr>
<tr><td>Smart Routing</td><td>Regex pre-routing + LLM-based triage for intent detection and agent selection</td></tr>
<tr><td>Resume Builder</td><td>Step-by-step conversational resume creation with Markdown output</td></tr>
<tr><td>Resume Analyzer</td><td>100-point ATS scoring across 6 categories with actionable feedback</td></tr>
<tr><td>Job Scout</td><td>Real-time web search for job postings matching user profile</td></tr>
<tr><td>Match Strategy</td><td>Resume vs. job description analysis with keyword gap identification</td></tr>
<tr><td>Application Writer</td><td>Tailored cover letters and optimized resume variants per job</td></tr>
<tr><td>PDF Upload</td><td>Client-side PDF parsing via pdfjs-dist (no server processing)</td></tr>
<tr><td>Dark/Light Theme</td><td>System preference detection + manual toggle</td></tr>
<tr><td>Korean/English</td><td>Full bilingual support with runtime language switching</td></tr>
</table>

<h2>Key Differentiators</h2>
<ul>
<li><strong>Unified Interface:</strong> All career tools in one chat &mdash; no app-switching</li>
<li><strong>Automatic Agent Handoff:</strong> Users don't need to know which agent to use; the system routes intelligently</li>
<li><strong>Real-time Job Data:</strong> Live web search, not a stale database</li>
<li><strong>Privacy-first PDF Handling:</strong> Resume parsing happens entirely in the browser</li>
<li><strong>Open Source:</strong> Full codebase available on GitHub under MIT license</li>
</ul>

<div class="page-break"></div>

<!-- ==================== 3. AGENT ARCHITECTURE ==================== -->
<h1>3. Agent Architecture</h1>

<h2>Six-Agent Pipeline</h2>

<div class="pipeline">
<span class="agent">Triage</span>
<span class="arrow">&rarr;</span>
<span class="agent">Builder</span>
<span class="arrow">&rarr;</span>
<span class="agent">Analyzer</span>
<span class="arrow">&rarr;</span>
<span class="agent">Scout</span>
<span class="arrow">&rarr;</span>
<span class="agent">Match</span>
<span class="arrow">&rarr;</span>
<span class="agent">Writer</span>
</div>

<p>The system uses the <strong>OpenAI Agents SDK</strong> (@openai/agents) with automatic handoff routing. Each agent is a specialized unit with its own system prompt, model, tools, and handoff targets.</p>

<table>
<tr><th>Agent</th><th>Model</th><th>Tools</th><th>Handoffs</th><th>Role</th></tr>
<tr><td>Triage</td><td>gpt-4o</td><td>None</td><td>&rarr; Builder, Analyzer, Scout</td><td>Entry point. Parses intent and routes to specialists.</td></tr>
<tr><td>Resume Builder</td><td>gpt-4o</td><td>generateResumeMD</td><td>&rarr; Analyzer</td><td>Interactive resume creation through conversation.</td></tr>
<tr><td>Resume Analyzer</td><td>gpt-4o</td><td>parseResume, calculateATS</td><td>&rarr; Scout</td><td>ATS scoring with 6-section breakdown.</td></tr>
<tr><td>Job Scout</td><td>gpt-4o</td><td>webSearch</td><td>None (server routing)</td><td>Real-time web search for matching jobs.</td></tr>
<tr><td>Match Strategy</td><td>gpt-4o</td><td>None</td><td>&rarr; Writer</td><td>Resume vs. JD fit analysis with gap identification.</td></tr>
<tr><td>Application Writer</td><td>gpt-4o</td><td>generateResumeMD</td><td>None</td><td>Tailored cover letters + optimized resumes.</td></tr>
</table>

<h2>Smart Routing Logic</h2>

<p>Routing happens in two stages:</p>

<h3>Stage 1: Server-side Regex Pre-routing</h3>
<p>Before any LLM call, the API route checks the user message against keyword patterns:</p>

<pre>
// Example patterns (supports Korean + English)
/job|search|find|internship|hiring/  &rarr;  Job Scout
/resume.*build|create|write/         &rarr;  Resume Builder
/resume.*analy|ATS|score/            &rarr;  Resume Analyzer
/cover.*letter/                      &rarr;  Application Writer
</pre>

<h3>Stage 2: LLM-based Triage (Fallback)</h3>
<p>If no regex matches, the Triage Agent uses gpt-4o to understand context and decide which specialist to hand off to. This handles ambiguous or complex requests.</p>

<h2>Reverse Routing (Server-side)</h2>
<p>The API route also handles cases where users change intent mid-conversation:</p>
<ul>
<li>From Match/Writer/Analyzer/Builder + search intent &rarr; redirects to Job Scout</li>
<li>From Scout + job selection &rarr; redirects to Match Strategy</li>
<li>Cover letter request from any non-Writer agent &rarr; redirects to Application Writer</li>
</ul>

<h2>Model Strategy</h2>

<table>
<tr><th>Component</th><th>Model</th><th>Rationale</th></tr>
<tr><td>All 6 Agents</td><td>gpt-4o</td><td>Consistent quality for conversation, reasoning, and handoff decisions</td></tr>
<tr><td>parseResumeText tool</td><td>gpt-4o-mini</td><td>Fast parsing task, lower cost sufficient</td></tr>
<tr><td>generateResumeMarkdown tool</td><td>gpt-4o-mini</td><td>Template-based generation, speed prioritized</td></tr>
<tr><td>calculateATSScore tool</td><td>gpt-4o</td><td>Precision required for scoring accuracy</td></tr>
</table>

<div class="page-break"></div>

<!-- ==================== 4. TOOL DEFINITIONS ==================== -->
<h1>4. Tool Definitions</h1>

<p>Agents use four tools to interact with external data and perform specialized tasks:</p>

<h2>parseResumeText</h2>
<table>
<tr><th>Property</th><th>Detail</th></tr>
<tr><td>Input</td><td>Resume text (string) + optional target role</td></tr>
<tr><td>Output</td><td>Structured JSON: contactInfo, education, experience, projects, skills</td></tr>
<tr><td>Model</td><td>gpt-4o-mini</td></tr>
<tr><td>Validation</td><td>Zod schema (runtime type checking)</td></tr>
<tr><td>Used by</td><td>Resume Analyzer</td></tr>
</table>

<h2>calculateATSScore</h2>
<table>
<tr><th>Property</th><th>Detail</th></tr>
<tr><td>Input</td><td>ParsedResume JSON + target role</td></tr>
<tr><td>Output</td><td>ATS Analysis: overall score (0-100), 6 section scores, strengths, improvements</td></tr>
<tr><td>Model</td><td>gpt-4o (standard, for precision)</td></tr>
<tr><td>Scoring</td><td>formatCompatibility(20) + keywordOptimization(25) + achievementQuality(20) + structuralCompleteness(15) + readability(10) + grammar(10) = 100</td></tr>
<tr><td>Used by</td><td>Resume Analyzer</td></tr>
</table>

<h2>generateResumeMarkdown</h2>
<table>
<tr><th>Property</th><th>Detail</th></tr>
<tr><td>Input</td><td>ParsedResume JSON</td></tr>
<tr><td>Output</td><td>ATS-optimized Markdown resume text</td></tr>
<tr><td>Model</td><td>gpt-4o-mini (temperature: 0.4)</td></tr>
<tr><td>Used by</td><td>Resume Builder, Application Writer</td></tr>
</table>

<h2>webSearchTool</h2>
<table>
<tr><th>Property</th><th>Detail</th></tr>
<tr><td>Provider</td><td>OpenAI built-in web search tool</td></tr>
<tr><td>Input</td><td>Search query (constructed by Job Scout agent)</td></tr>
<tr><td>Output</td><td>Real-time web search results (job postings)</td></tr>
<tr><td>Constraint</td><td>Minimum 2 searches per request for comprehensive results</td></tr>
<tr><td>Used by</td><td>Job Scout</td></tr>
</table>

<div class="page-break"></div>

<!-- ==================== 5. API DESIGN ==================== -->
<h1>5. API Design</h1>

<h2>Endpoint</h2>
<p><code>POST /api/agent</code></p>

<h2>Request Schema</h2>
<pre>
{
  messages: Array&lt;{
    role: 'user' | 'assistant';
    content: string;
  }&gt;;
  sessionId: string;          // Unique session identifier
  resumeText?: string;        // PDF-extracted text (optional)
  lastResponseId?: string;    // For conversation chaining
  activeAgentName?: string;   // Current agent context
  language?: 'ko' | 'en';     // Response language
}
</pre>

<h2>Response Schema</h2>
<pre>
{
  output: string;              // Agent's text response
  activeAgent: string;         // Currently active agent name
  structuredData:              // Discriminated union
    | { type: 'ats_analysis'; data: ATSAnalysis }
    | { type: 'match_analysis'; data: MatchAnalysis }
    | { type: 'job_results'; data: JobSearchResult[] }
    | null;
  lastResponseId?: string;     // For next request
  generatedFiles?: Array&lt;{     // Downloadable files
    type: string;
    content: string;
    fileName: string;
  }&gt;;
  error?: string;
}
</pre>

<h2>Session Management</h2>
<p>Conversations are chained using OpenAI's <code>previousResponseId</code> mechanism. Each response returns a <code>lastResponseId</code> that the client sends with the next request, maintaining full conversation context without server-side storage.</p>

<h2>Error Handling &amp; Retry</h2>
<table>
<tr><th>Mechanism</th><th>Detail</th></tr>
<tr><td>Automatic Retry</td><td>2 retries with exponential backoff (1s base delay)</td></tr>
<tr><td>Retry Triggers</td><td>HTTP 429 (rate limit), 5xx errors, network failures</td></tr>
<tr><td>Input Limit</td><td>50,000 characters per tool input</td></tr>
<tr><td>Validation</td><td>Zod schemas for all tool inputs/outputs</td></tr>
</table>

<h2>Rate Limiting</h2>
<table>
<tr><th>Parameter</th><th>Value</th></tr>
<tr><td>Window</td><td>60 seconds</td></tr>
<tr><td>Max Requests</td><td>20 per IP per window</td></tr>
<tr><td>Implementation</td><td>In-memory Map (per worker instance)</td></tr>
<tr><td>Body Size Limit</td><td>500 KB (~500,000 bytes)</td></tr>
<tr><td>Max Messages</td><td>50 per request (older truncated)</td></tr>
</table>

<div class="page-break"></div>

<!-- ==================== 6. TECHNICAL ARCHITECTURE ==================== -->
<h1>6. Technical Architecture</h1>

<h2>Tech Stack</h2>
<table>
<tr><th>Layer</th><th>Technology</th><th>Purpose</th></tr>
<tr><td>UI Framework</td><td>Next.js 16.1.6 (App Router)</td><td>Server + client rendering with React 19.2.3</td></tr>
<tr><td>Agent SDK</td><td>@openai/agents ^0.6.0</td><td>Multi-agent orchestration with handoffs</td></tr>
<tr><td>LLM</td><td>GPT-4o / GPT-4o-mini</td><td>Language understanding and generation</td></tr>
<tr><td>Styling</td><td>Tailwind CSS v4</td><td>Utility-first CSS with @theme config</td></tr>
<tr><td>PDF Parsing</td><td>pdfjs-dist ^5.5.207</td><td>Client-side PDF text extraction</td></tr>
<tr><td>Validation</td><td>Zod ^4.3.6</td><td>Runtime type checking for API I/O</td></tr>
<tr><td>Compiler</td><td>React Compiler 1.0.0</td><td>Automatic memoization optimization</td></tr>
<tr><td>Markdown</td><td>react-markdown ^10.1.0</td><td>Rich text rendering in chat</td></tr>
<tr><td>Icons</td><td>Lucide React ^0.577.0</td><td>Consistent icon set</td></tr>
<tr><td>Hosting</td><td>Cloudflare Pages</td><td>Global CDN, edge rendering</td></tr>
<tr><td>Adapter</td><td>@opennextjs/cloudflare ^1.17.1</td><td>Next.js &rarr; Cloudflare Workers conversion</td></tr>
</table>

<h2>Project Structure</h2>
<pre>
src/
&#9500;&#9472;&#9472; app/
&#9474;   &#9500;&#9472;&#9472; page.tsx              # Landing page
&#9474;   &#9500;&#9472;&#9472; layout.tsx            # Root layout (Theme, i18n, Toast)
&#9474;   &#9500;&#9472;&#9472; agent/page.tsx        # Chat interface
&#9474;   &#9492;&#9472;&#9472; api/agent/route.ts    # Agent API endpoint
&#9474;
&#9500;&#9472;&#9472; lib/
&#9474;   &#9500;&#9472;&#9472; agents/
&#9474;   &#9474;   &#9500;&#9472;&#9472; definitions.ts    # 6 agent configurations
&#9474;   &#9474;   &#9500;&#9472;&#9472; tools.ts          # 3 agent tools
&#9474;   &#9474;   &#9500;&#9472;&#9472; model-config.ts   # GPT model selection
&#9474;   &#9474;   &#9492;&#9472;&#9472; constants.ts      # Agent name constants
&#9474;   &#9500;&#9472;&#9472; types.ts              # Shared TypeScript types
&#9474;   &#9500;&#9472;&#9472; i18n.ts               # Translation dictionary
&#9474;   &#9492;&#9472;&#9472; theme-context.tsx     # Dark/Light theme
&#9474;
&#9492;&#9472;&#9472; components/
    &#9500;&#9472;&#9472; chat/
    &#9474;   &#9500;&#9472;&#9472; ChatInterface.tsx  # Main chat logic
    &#9474;   &#9500;&#9472;&#9472; MessageBubble.tsx  # Message rendering
    &#9474;   &#9492;&#9472;&#9472; AgentStatusPanel.tsx  # Pipeline sidebar
    &#9500;&#9472;&#9472; resume/
    &#9474;   &#9500;&#9472;&#9472; ResumeUploader.tsx # PDF upload
    &#9474;   &#9492;&#9472;&#9472; ATSScoreCard.tsx   # Score visualization
    &#9492;&#9472;&#9472; jobs/
        &#9492;&#9472;&#9472; JobCard.tsx         # Job posting card
</pre>

<h2>Key Implementation Details</h2>
<ul>
<li><strong>PDF Processing:</strong> Entirely client-side using pdfjs-dist. No resume data is sent to any third-party service.</li>
<li><strong>React Compiler:</strong> Enabled for automatic memoization &mdash; no manual useMemo/useCallback needed.</li>
<li><strong>Stateless Backend:</strong> Resume text is passed in the request body. No database or file storage.</li>
<li><strong>Conversation Chaining:</strong> OpenAI's <code>previousResponseId</code> maintains multi-turn context without server state.</li>
<li><strong>Zod Validation:</strong> All tool inputs/outputs are validated at runtime to prevent malformed data.</li>
<li><strong>AsyncLocalStorage Polyfill:</strong> Cloudflare Workers polyfill for OpenAI Agents SDK compatibility (enterWith no-op).</li>
<li><strong>Webpack Mode:</strong> Used instead of Turbopack due to compatibility issues with pdfjs-dist.</li>
</ul>

<div class="page-break"></div>

<!-- ==================== 7. ATS SCORING SYSTEM ==================== -->
<h1>7. ATS Scoring System</h1>

<p>The Resume Analyzer evaluates resumes on a 100-point scale across six categories, designed to mirror how real Applicant Tracking Systems (like Workday, Greenhouse, and Lever) evaluate candidates.</p>

<table>
<tr><th>Category</th><th>Points</th><th>What It Measures</th></tr>
<tr><td>Format Compatibility</td><td>20</td><td>Clean structure, standard sections, parseable layout, consistent formatting</td></tr>
<tr><td>Keyword Optimization</td><td>25</td><td>Industry-standard terminology, role-specific keywords, skill-job alignment</td></tr>
<tr><td>Achievement Quality</td><td>20</td><td>Quantified results, action verbs, measurable impact statements</td></tr>
<tr><td>Structural Completeness</td><td>15</td><td>All essential sections present: contact, education, experience, skills</td></tr>
<tr><td>Readability</td><td>10</td><td>Clear language, appropriate length, logical flow, bullet point usage</td></tr>
<tr><td>Grammar &amp; Spelling</td><td>10</td><td>Error-free writing, professional tone, consistent tense</td></tr>
</table>

<h2>Output Format</h2>
<p>Each category includes:</p>
<ul>
<li><strong>Score:</strong> Numeric value out of the category maximum</li>
<li><strong>Feedback:</strong> Specific strengths and improvement suggestions</li>
<li><strong>Examples:</strong> Concrete recommendations (e.g., "Add keywords: Agile, Scrum, CI/CD")</li>
</ul>

<p>The overall score also includes:</p>
<ul>
<li><strong>Top 3 Strengths:</strong> What the resume does well</li>
<li><strong>Top 3 Critical Improvements:</strong> Most impactful changes to make</li>
</ul>

<div class="page-break"></div>

<!-- ==================== 8. DEPLOYMENT ==================== -->
<h1>8. Deployment</h1>

<h2>Cloudflare Pages (Primary)</h2>

<p>The application is deployed on Cloudflare Pages using the OpenNext adapter, which converts Next.js output into Cloudflare Workers-compatible format.</p>

<table>
<tr><th>Component</th><th>Detail</th></tr>
<tr><td>Adapter</td><td>@opennextjs/cloudflare 1.17.1</td></tr>
<tr><td>Worker</td><td>.open-next/worker.js</td></tr>
<tr><td>Assets</td><td>.open-next/assets/ (Cloudflare Cache)</td></tr>
<tr><td>Compatibility</td><td>Node.js compat flags enabled</td></tr>
</table>

<h3>Build &amp; Deploy Commands</h3>
<pre>
# Development
npm run dev          # Local dev server (localhost:3000)

# Cloudflare deployment
npm run cf:build     # Build for Cloudflare
npm run cf:preview   # Local preview
npm run cf:deploy    # Deploy to production

# Environment variables
npx wrangler secret put OPENAI_API_KEY
</pre>

<h2>Alternative: Vercel</h2>
<pre>
npm run build        # Standard Next.js build
npm run start        # Local production server
# Set OPENAI_API_KEY in Vercel Dashboard &rarr; Settings &rarr; Environment Variables
</pre>

<h2>Environment Variables</h2>
<table>
<tr><th>Variable</th><th>Required</th><th>Description</th></tr>
<tr><td>OPENAI_API_KEY</td><td>Yes</td><td>OpenAI API key for agent execution and web search</td></tr>
</table>

<!-- ==================== 9. INTERNATIONALIZATION ==================== -->
<h1>9. Internationalization</h1>

<p>My Offer Agent supports Korean and English with runtime language switching. The user's preference is persisted in the browser.</p>

<table>
<tr><th>Code</th><th>Language</th><th>Coverage</th></tr>
<tr><td>en</td><td>English</td><td>Full (default)</td></tr>
<tr><td>ko</td><td>Korean</td><td>Full</td></tr>
</table>

<h2>Implementation</h2>
<ul>
<li><strong>Approach:</strong> Flat key-value dictionary in <code>i18n.ts</code></li>
<li><strong>State:</strong> React Context (<code>i18n-context.tsx</code>) + localStorage persistence</li>
<li><strong>Scope:</strong> UI labels, tooltips, agent sidebar, error messages, placeholders</li>
<li><strong>Agent Language:</strong> Language parameter sent to API; English mode prepends instruction to force English responses</li>
</ul>

<p>No URL-based locale routing or heavyweight i18n libraries &mdash; a lightweight approach suited for a bilingual application.</p>

<div class="footer">
<p><strong>My Offer Agent</strong> developed by Chanjoong Kim</p>
<p>Email: chanjoongx@gmail.com | GitHub: github.com/chanjoongx/myofferagent</p>
</div>

</body>
</html>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: "networkidle" });

  const outPath = resolve(__dirname, "MyOfferAgent-Guide.pdf");
  await page.pdf({
    path: outPath,
    format: "A4",
    margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
    printBackground: true,
  });

  console.log("PDF generated:", outPath);
  await browser.close();
}

main().catch(console.error);
