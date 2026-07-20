import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak, PageNumber, LevelFormat, ExternalHyperlink,
  TableOfContents } from "docx";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Colors ──
const TEAL = "0F766E";
const TEAL_LIGHT = "F0FDFA";
const TEAL_MED = "99F6E4";
const GRAY_50 = "F9FAFB";
const GRAY_200 = "E5E7EB";
const GRAY_500 = "6B7280";
const GRAY_700 = "374151";
const GRAY_900 = "1F2937";
const WHITE = "FFFFFF";
const CODE_BG = "F3F4F6";

// ── Borders ──
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: GRAY_200 };
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const noBorder = { style: BorderStyle.NONE, size: 0, color: WHITE };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

// ── Page dimensions (A4) ──
const PAGE_WIDTH = 11906;
const MARGIN = 1440;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 9026

// ── Helpers ──
function headerCell(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: TEAL, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: WHITE, font: "Arial", size: 20 })] })],
  });
}

function cell(text, width, opts = {}) {
  const runs = typeof text === "string"
    ? [new TextRun({ text, font: "Arial", size: 20, color: GRAY_900, ...opts })]
    : text;
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: runs })],
  });
}

function boldCell(text, width, opts = {}) {
  return cell(text, width, { bold: true, ...opts });
}

function makeTable(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({ children: headers.map((h, i) => headerCell(h, colWidths[i])) }),
      ...rows.map((row, ri) =>
        new TableRow({
          children: row.map((c, ci) => {
            if (typeof c === "object" && c._isCell) return c;
            return cell(c, colWidths[ci], ri % 2 === 1 ? { shading: GRAY_50 } : {});
          }),
        })
      ),
    ],
  });
}

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 36, color: TEAL })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: TEAL_MED, space: 4 } },
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 28, color: GRAY_900 })],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 24, color: GRAY_700 })],
  });
}

function para(text, opts = {}) {
  const runs = typeof text === "string"
    ? [new TextRun({ text, font: "Arial", size: 22, color: GRAY_900, ...opts })]
    : text;
  return new Paragraph({ spacing: { after: 120 }, children: runs, ...opts.paraOpts });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 60 },
    children: typeof text === "string"
      ? [new TextRun({ text, font: "Arial", size: 22, color: GRAY_900 })]
      : text,
  });
}

function codePara(text) {
  return new Paragraph({
    spacing: { after: 40 },
    shading: { fill: CODE_BG, type: ShadingType.CLEAR },
    children: [new TextRun({ text, font: "Consolas", size: 18, color: GRAY_900 })],
  });
}

function codeBlock(lines) {
  return lines.map(l => codePara(l));
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 60 }, children: [] });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function boldText(text) {
  return new TextRun({ text, bold: true, font: "Arial", size: 22, color: GRAY_900 });
}

function normalText(text) {
  return new TextRun({ text, font: "Arial", size: 22, color: GRAY_900 });
}

function pipelineBox(text) {
  return new TextRun({ text: ` ${text} `, font: "Arial", size: 22, bold: true, color: TEAL });
}
function arrow() {
  return new TextRun({ text: "  \u2192  ", font: "Arial", size: 22, color: GRAY_500 });
}

// ── Document ──
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22, color: GRAY_900 } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: TEAL },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: GRAY_900 },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: GRAY_700 },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
        ],
      },
      {
        reference: "numbers",
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        ],
      },
    ],
  },
  sections: [
    // ════════════════════ COVER PAGE ════════════════════
    {
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: 16838 },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 4800, after: 200 },
          children: [new TextRun({ text: "My Offer Agent", bold: true, font: "Arial", size: 56, color: GRAY_900 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: "AI-Powered Career Pipeline", font: "Arial", size: 28, color: GRAY_500 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: "Technical Guide & Project Documentation", font: "Arial", size: 24, color: GRAY_700 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [new TextRun({ text: "Chanjoong Kim", font: "Arial", size: 24, color: GRAY_700 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "chanjoongx@gmail.com", font: "Arial", size: 20, color: GRAY_500 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: "Version 1.0.0  |  March 2026", font: "Arial", size: 20, color: GRAY_500 })],
        }),
        // Project Info table (centered)
        new Table({
          width: { size: 6000, type: WidthType.DXA },
          columnWidths: [2400, 3600],
          rows: [
            new TableRow({ children: [
              headerCell("Project Information", 2400),
              new TableCell({ borders, width: { size: 3600, type: WidthType.DXA }, shading: { fill: TEAL, type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [] })] }),
            ] }),
            new TableRow({ children: [boldCell("Live Demo", 2400), cell("myofferagent.com", 3600)] }),
            new TableRow({ children: [boldCell("Tech Stack", 2400, { shading: GRAY_50 }), cell("Next.js 16.1.6 / OpenAI Agents SDK / Tailwind CSS v4", 3600, { shading: GRAY_50 })] }),
            new TableRow({ children: [boldCell("Deployment", 2400), cell("Cloudflare Pages", 3600)] }),
            new TableRow({ children: [boldCell("License", 2400, { shading: GRAY_50 }), cell("MIT", 3600, { shading: GRAY_50 })] }),
          ],
        }),
        pageBreak(),

        // ════════════════════ TABLE OF CONTENTS ════════════════════
        heading1("Table of Contents"),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
        pageBreak(),

        // ════════════════════ 1. PROJECT OVERVIEW ════════════════════
        heading1("1. Project Overview"),
        heading2("What is My Offer Agent?"),
        para("My Offer Agent is a conversational AI platform that helps job seekers manage their entire application process \u2014 from building resumes, to searching for jobs, to preparing tailored application materials \u2014 all through a single chat interface powered by six specialized AI agents."),
        emptyLine(),
        para([boldText("Key capabilities:")]),
        bullet("Six specialized AI agents with automatic handoff between them"),
        bullet("Real-time job search powered by web search APIs"),
        bullet("ATS (Applicant Tracking System) resume scoring with 100-point breakdown"),
        bullet("Tailored cover letter and resume generation for specific job postings"),
        bullet("Client-side PDF resume parsing \u2014 no data sent to third-party services"),

        heading2("Problem Statement"),
        para("Job seekers today must juggle multiple disconnected tools: resume builders, job boards, ATS checkers, cover letter generators, and career advisors. Each tool has its own interface, data format, and learning curve. This fragmentation wastes time and creates gaps in the application strategy."),
        para("My Offer Agent consolidates the entire workflow into one conversational interface where users simply describe what they need, and the system automatically routes to the right specialist agent."),

        heading2("Target Users"),
        bullet("Job seekers preparing applications for multiple positions"),
        bullet("Students entering the job market for the first time"),
        bullet("Career changers who need resume optimization for a new field"),
        bullet("International applicants who need help with English-language resumes"),

        pageBreak(),

        // ════════════════════ 2. CORE FEATURES ════════════════════
        heading1("2. Core Features"),
        makeTable(
          ["Feature", "Description"],
          [
            ["Smart Routing", "Regex pre-routing + LLM-based triage for intent detection and agent selection"],
            ["Resume Builder", "Step-by-step conversational resume creation with Markdown output"],
            ["Resume Analyzer", "100-point ATS scoring across 6 categories with actionable feedback"],
            ["Job Scout", "Real-time web search for job postings matching user profile"],
            ["Match Strategy", "Resume vs. job description analysis with keyword gap identification"],
            ["Application Writer", "Tailored cover letters and optimized resume variants per job"],
            ["PDF Upload", "Client-side PDF parsing via pdfjs-dist (no server processing)"],
            ["Dark/Light Theme", "System preference detection + manual toggle"],
            ["Korean/English", "Full bilingual support with runtime language switching"],
          ],
          [2400, 6626]
        ),

        heading2("Key Differentiators"),
        bullet([boldText("Unified Interface: "), normalText("All career tools in one chat \u2014 no app-switching")]),
        bullet([boldText("Automatic Agent Handoff: "), normalText("Users don\u2019t need to know which agent to use; the system routes intelligently")]),
        bullet([boldText("Real-time Job Data: "), normalText("Live web search, not a stale database")]),
        bullet([boldText("Privacy-first PDF Handling: "), normalText("Resume parsing happens entirely in the browser")]),
        bullet([boldText("Open Source: "), normalText("Full codebase available on GitHub under MIT license")]),

        pageBreak(),

        // ════════════════════ 3. AGENT ARCHITECTURE ════════════════════
        heading1("3. Agent Architecture"),
        heading2("Six-Agent Pipeline"),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
          children: [
            pipelineBox("Triage"), arrow(),
            pipelineBox("Builder"), arrow(),
            pipelineBox("Analyzer"), arrow(),
            pipelineBox("Scout"), arrow(),
            pipelineBox("Match"), arrow(),
            pipelineBox("Writer"),
          ],
        }),
        para("The system uses the OpenAI Agents SDK (@openai/agents) with automatic handoff routing. Each agent is a specialized unit with its own system prompt, model, tools, and handoff targets."),
        emptyLine(),
        makeTable(
          ["Agent", "Model", "Tools", "Handoffs", "Role"],
          [
            ["Triage", "gpt-4o", "None", "\u2192 Builder, Analyzer, Scout", "Entry point. Parses intent and routes to specialists."],
            ["Resume Builder", "gpt-4o", "generateResumeMD", "\u2192 Analyzer", "Interactive resume creation through conversation."],
            ["Resume Analyzer", "gpt-4o", "parseResume, calculateATS", "\u2192 Scout", "ATS scoring with 6-section breakdown."],
            ["Job Scout", "gpt-4o", "webSearch", "None (server routing)", "Real-time web search for matching jobs."],
            ["Match Strategy", "gpt-4o", "None", "\u2192 Writer", "Resume vs. JD fit analysis with gap identification."],
            ["Application Writer", "gpt-4o", "generateResumeMD", "None", "Tailored cover letters + optimized resumes."],
          ],
          [1600, 900, 1800, 2000, 2726]
        ),

        heading2("Smart Routing Logic"),
        para("Routing happens in two stages:"),
        heading3("Stage 1: Server-side Regex Pre-routing"),
        para("Before any LLM call, the API route checks the user message against keyword patterns:"),
        ...codeBlock([
          "/\uCC44\uC6A9|\uACF5\uACE0|\uAC80\uC0C9|\uCC3E\uC544|\uC7A1|\uC778\uD134|\uAD6C\uC9C1|search|find.*job|hiring/  \u2192  Job Scout",
          "/\uC774\uB825\uC11C.{0,4}(\uB9CC\uB4E4|\uC791\uC131|\uC368|\uC0DD\uC131|\uC5C6|\uC2DC\uC791)|resume.{0,4}(create|build|make)/  \u2192  Resume Builder",
          "/\uC774\uB825\uC11C.{0,4}(\uBD84\uC11D|\uAC80\uD1A0|\uD3C9\uAC00|\uBD10|\uC810\uC218)|ats|resume.{0,4}(analy|review)/  \u2192  Resume Analyzer",
          "/\uCEE4\uBC84\\s*\uB808\uD130|\uC790\uAE30\\s*\uC18C\uAC1C\uC11C|cover\\s*letter/  \u2192  Application Writer",
          "/(\\d{1,2})\\s*(\uBC88|\uBC88\uC9F8|\uBD84\uC11D|\uC120\uD0DD)/  \u2192  Match Strategy (from Scout context)",
        ]),

        heading3("Stage 2: LLM-based Triage (Fallback)"),
        para("If no regex matches, the Triage Agent uses gpt-4o to understand context and decide which specialist to hand off to. This handles ambiguous or complex requests."),

        heading2("Reverse Routing (Server-side)"),
        para("The API route also handles cases where users change intent mid-conversation:"),
        bullet("From Match/Writer/Analyzer/Builder + search intent \u2192 redirects to Job Scout"),
        bullet("From Scout + job selection \u2192 redirects to Match Strategy"),
        bullet("Cover letter request from any non-Writer agent \u2192 redirects to Application Writer"),

        heading2("Model Strategy"),
        makeTable(
          ["Component", "Model", "Rationale"],
          [
            ["All 6 Agents", "gpt-4o", "Consistent quality for conversation, reasoning, and handoff decisions"],
            ["parseResumeText tool", "gpt-4o-mini", "Fast parsing task, lower cost sufficient"],
            ["generateResumeMarkdown tool", "gpt-4o-mini", "Template-based generation, speed prioritized"],
            ["calculateATSScore tool", "gpt-4o", "Precision required for scoring accuracy"],
          ],
          [2800, 1600, 4626]
        ),

        pageBreak(),

        // ════════════════════ 4. TOOL DEFINITIONS ════════════════════
        heading1("4. Tool Definitions"),
        para("Agents use four tools to interact with external data and perform specialized tasks:"),

        heading2("parseResumeText"),
        makeTable(["Property", "Detail"], [
          ["Input", "Resume text (string, max 50,000 chars) + optional target role"],
          ["Output", "Structured JSON (ParsedResume): contactInfo, education, experience, projects, skills"],
          ["Model", "gpt-4o-mini (MODEL_CONFIG.fast)"],
          ["Validation", "Zod schema (runtime type checking)"],
          ["Used by", "Resume Analyzer"],
        ], [2000, 7026]),

        heading2("calculateATSScore"),
        makeTable(["Property", "Detail"], [
          ["Input", "ParsedResume JSON + target role"],
          ["Output", "ATS Analysis: overall score (0\u2013100), 6 section scores, strengths, improvements"],
          ["Model", "gpt-4o (MODEL_CONFIG.standard) \u2014 precision required"],
          ["Scoring", "formatCompatibility(20) + keywordOptimization(25) + achievementQuality(20) + structuralCompleteness(15) + readability(10) + grammar(10) = 100"],
          ["Validation", "Zod schema (ATSAnalysisSchema)"],
          ["Used by", "Resume Analyzer"],
        ], [2000, 7026]),

        heading2("generateResumeMarkdown"),
        makeTable(["Property", "Detail"], [
          ["Input", "ParsedResume JSON (max 50,000 chars)"],
          ["Output", "ATS-optimized Markdown resume text"],
          ["Model", "gpt-4o-mini (MODEL_CONFIG.fast, temperature: 0.4)"],
          ["Format", "Free-text markdown (no JSON response format)"],
          ["Used by", "Resume Builder, Application Writer"],
        ], [2000, 7026]),

        heading2("webSearchTool"),
        makeTable(["Property", "Detail"], [
          ["Provider", "OpenAI built-in web search tool (@openai/agents SDK)"],
          ["Input", "Search query (constructed by Job Scout agent)"],
          ["Output", "Real-time web search results (job postings)"],
          ["Constraint", "Minimum 2 searches per request for comprehensive results"],
          ["Used by", "Job Scout"],
        ], [2000, 7026]),

        heading2("Common Infrastructure"),
        bullet("Retry logic: 2 retries with exponential backoff (1s base delay)"),
        bullet("Retry triggers: HTTP 429 (rate limit), 5xx errors, network failures"),
        bullet("Input limit: 50,000 characters per tool input"),
        bullet("API calls via callOpenAI() helper function (direct fetch to OpenAI API)"),

        pageBreak(),

        // ════════════════════ 5. API DESIGN ════════════════════
        heading1("5. API Design"),
        heading2("Endpoint"),
        para([new TextRun({ text: "POST /api/agent", font: "Consolas", size: 22, bold: true, color: TEAL })]),

        heading2("Request Schema (AgentRequest)"),
        ...codeBlock([
          "{",
          "  messages: Array<{ role: 'user' | 'assistant'; content: string }>;",
          "  sessionId: string;",
          "  resumeText?: string;          // PDF-extracted text",
          "  lastResponseId?: string;      // For conversation chaining",
          "  activeAgentName?: string;     // Current agent context",
          "  language?: 'ko' | 'en';      // Response language",
          "}",
        ]),

        heading2("Response Schema (AgentResponse)"),
        ...codeBlock([
          "{",
          "  output: string;",
          "  activeAgent: string;",
          "  structuredData:               // Discriminated union",
          "    | { type: 'ats_analysis'; data: ATSAnalysis }",
          "    | { type: 'match_analysis'; data: MatchAnalysis }",
          "    | { type: 'job_results'; data: JobSearchResult[] }",
          "    | null;",
          "  lastResponseId?: string;",
          "  generatedFiles?: Array<{",
          "    type: string;",
          "    content: string;",
          "    fileName: string;",
          "  }>;",
          "  error?: string;",
          "}",
        ]),

        heading2("Session Management"),
        para("Conversations are chained using OpenAI\u2019s previousResponseId mechanism. Each response returns a lastResponseId that the client sends with the next request, maintaining full conversation context without server-side storage."),

        heading2("Rate Limiting"),
        makeTable(["Parameter", "Value"], [
          ["Window", "60 seconds"],
          ["Max Requests", "20 per IP per window"],
          ["Implementation", "In-memory Map (per worker instance)"],
          ["Body Size Limit", "500 KB (~500,000 bytes)"],
          ["Max Messages", "50 per request (older messages truncated)"],
          ["Cleanup", "Lazy cleanup when map size exceeds 1,000 entries"],
        ], [2800, 6226]),

        heading2("Input Validation"),
        bullet("Language parameter: validated against allowlist ('ko', 'en')"),
        bullet("Resume text: minimum 50 characters required (shorter texts ignored)"),
        bullet("Messages array: capped at 50 entries"),
        bullet("Structured data output: validated before sending to client"),

        pageBreak(),

        // ════════════════════ 6. TECHNICAL ARCHITECTURE ════════════════════
        heading1("6. Technical Architecture"),
        heading2("Tech Stack"),
        makeTable(
          ["Layer", "Technology", "Version", "Purpose"],
          [
            ["UI Framework", "Next.js (App Router)", "16.1.6", "Server + client rendering with React 19"],
            ["Runtime", "React", "19.2.3", "UI rendering with React Compiler"],
            ["Agent SDK", "@openai/agents", "^0.6.0", "Multi-agent orchestration with handoffs"],
            ["LLM", "GPT-4o / GPT-4o-mini", "\u2014", "Language understanding and generation"],
            ["Styling", "Tailwind CSS", "v4", "Utility-first CSS with @theme config"],
            ["PDF Parsing", "pdfjs-dist", "^5.5.207", "Client-side PDF text extraction"],
            ["Validation", "Zod", "^4.3.6", "Runtime type checking for API I/O"],
            ["Compiler", "React Compiler", "1.0.0", "Automatic memoization optimization"],
            ["Markdown", "react-markdown + remark-gfm", "^10.1.0 / ^4.0.1", "Rich text rendering in chat"],
            ["Icons", "Lucide React", "^0.577.0", "Consistent icon set"],
            ["Hosting", "Cloudflare Pages", "\u2014", "Global CDN, edge rendering"],
            ["Adapter", "@opennextjs/cloudflare", "^1.17.1", "Next.js \u2192 Cloudflare Workers conversion"],
          ],
          [1600, 2600, 1600, 3226]
        ),

        heading2("Project Structure"),
        ...codeBlock([
          "src/",
          "\u251C\u2500\u2500 app/",
          "\u2502   \u251C\u2500\u2500 page.tsx              # Landing page",
          "\u2502   \u251C\u2500\u2500 layout.tsx            # Root layout (Theme, i18n, Toast)",
          "\u2502   \u251C\u2500\u2500 agent/page.tsx        # Chat interface",
          "\u2502   \u2514\u2500\u2500 api/agent/route.ts    # Agent API endpoint",
          "\u2502",
          "\u251C\u2500\u2500 lib/",
          "\u2502   \u251C\u2500\u2500 agents/",
          "\u2502   \u2502   \u251C\u2500\u2500 definitions.ts    # 6 agent configurations",
          "\u2502   \u2502   \u251C\u2500\u2500 tools.ts          # 3 agent tools + callOpenAI helper",
          "\u2502   \u2502   \u251C\u2500\u2500 model-config.ts   # GPT model selection",
          "\u2502   \u2502   \u2514\u2500\u2500 constants.ts      # Agent name constants (AGENT_NAMES)",
          "\u2502   \u251C\u2500\u2500 types.ts              # Shared TypeScript types",
          "\u2502   \u251C\u2500\u2500 i18n.ts               # Translation dictionary",
          "\u2502   \u2514\u2500\u2500 theme-context.tsx     # Dark/Light theme",
          "\u2502",
          "\u2514\u2500\u2500 components/",
          "    \u251C\u2500\u2500 chat/",
          "    \u2502   \u251C\u2500\u2500 ChatInterface.tsx  # Main chat logic",
          "    \u2502   \u251C\u2500\u2500 MessageBubble.tsx  # Message rendering",
          "    \u2502   \u2514\u2500\u2500 AgentStatusPanel.tsx  # Pipeline sidebar",
          "    \u251C\u2500\u2500 resume/",
          "    \u2502   \u251C\u2500\u2500 ResumeUploader.tsx # PDF upload",
          "    \u2502   \u2514\u2500\u2500 ATSScoreCard.tsx   # Score visualization",
          "    \u2514\u2500\u2500 jobs/",
          "        \u2514\u2500\u2500 JobCard.tsx         # Job posting card",
        ]),

        heading2("Key Implementation Details"),
        bullet([boldText("PDF Processing: "), normalText("Entirely client-side using pdfjs-dist loaded from CDN. No resume data is sent to any third-party service.")]),
        bullet([boldText("React Compiler: "), normalText("Enabled via babel-plugin-react-compiler for automatic memoization \u2014 no manual useMemo/useCallback needed.")]),
        bullet([boldText("Stateless Backend: "), normalText("Resume text is passed in the request body. No database or file storage.")]),
        bullet([boldText("Conversation Chaining: "), normalText("OpenAI\u2019s previousResponseId maintains multi-turn context without server state.")]),
        bullet([boldText("Zod Validation: "), normalText("All tool inputs/outputs are validated at runtime to prevent malformed data.")]),
        bullet([boldText("AsyncLocalStorage Polyfill: "), normalText("Cloudflare Workers polyfill for OpenAI Agents SDK compatibility (enterWith no-op).")]),
        bullet([boldText("Webpack Mode: "), normalText("Used instead of Turbopack due to compatibility issues with pdfjs-dist.")]),

        pageBreak(),

        // ════════════════════ 7. ATS SCORING SYSTEM ════════════════════
        heading1("7. ATS Scoring System"),
        para("The Resume Analyzer evaluates resumes on a 100-point scale across six categories, designed to mirror how real Applicant Tracking Systems (like Workday, Greenhouse, and Lever) evaluate candidates."),
        emptyLine(),
        makeTable(
          ["Category", "Points", "What It Measures"],
          [
            ["Format Compatibility", "20", "Clean structure, standard sections, parseable layout, consistent formatting"],
            ["Keyword Optimization", "25", "Industry-standard terminology, role-specific keywords, skill-job alignment"],
            ["Achievement Quality", "20", "Quantified results, action verbs, measurable impact statements"],
            ["Structural Completeness", "15", "All essential sections present: contact, education, experience, skills"],
            ["Readability", "10", "Clear language, appropriate length, logical flow, bullet point usage"],
            ["Grammar & Spelling", "10", "Error-free writing, professional tone, consistent tense"],
          ],
          [2400, 800, 5826]
        ),

        heading2("Output Format"),
        para("Each category includes:"),
        bullet([boldText("Score: "), normalText("Numeric value out of the category maximum")]),
        bullet([boldText("Feedback: "), normalText("Specific strengths and improvement suggestions")]),
        bullet([boldText("Examples: "), normalText("Concrete recommendations (e.g., \"Add keywords: Agile, Scrum, CI/CD\")")]),
        emptyLine(),
        para("The overall score also includes:"),
        bullet([boldText("Top 3 Strengths: "), normalText("What the resume does well")]),
        bullet([boldText("Top 3 Critical Improvements: "), normalText("Most impactful changes to make")]),

        pageBreak(),

        // ════════════════════ 8. DEPLOYMENT ════════════════════
        heading1("8. Deployment"),
        heading2("Cloudflare Pages (Primary)"),
        para("The application is deployed on Cloudflare Pages using the OpenNext adapter, which converts Next.js output into Cloudflare Workers-compatible format."),
        makeTable(["Component", "Detail"], [
          ["Adapter", "@opennextjs/cloudflare ^1.17.1"],
          ["Worker", ".open-next/worker.js"],
          ["Assets", ".open-next/assets/ (Cloudflare Cache)"],
          ["Compatibility", "Node.js compat flags enabled"],
        ], [2400, 6626]),

        heading3("Build & Deploy Commands"),
        ...codeBlock([
          "# Development",
          "npm run dev          # Local dev server (localhost:3000, webpack mode)",
          "",
          "# Cloudflare deployment",
          "npm run cf:build     # Build for Cloudflare",
          "npm run cf:preview   # Local preview (build + wrangler dev)",
          "npm run cf:deploy    # Deploy to production (build + wrangler deploy)",
          "",
          "# Environment variables",
          "npx wrangler secret put OPENAI_API_KEY",
        ]),

        heading2("Alternative: Vercel"),
        ...codeBlock([
          "npm run build        # Standard Next.js build",
          "npm run start        # Local production server",
          "# Set OPENAI_API_KEY in Vercel Dashboard \u2192 Settings \u2192 Environment Variables",
        ]),

        heading2("Environment Variables"),
        makeTable(["Variable", "Required", "Description"], [
          ["OPENAI_API_KEY", "Yes", "OpenAI API key for agent execution and web search"],
        ], [2400, 1200, 5426]),

        pageBreak(),

        // ════════════════════ 9. INTERNATIONALIZATION ════════════════════
        heading1("9. Internationalization"),
        para("My Offer Agent supports Korean and English with runtime language switching. The user\u2019s preference is persisted in the browser via localStorage."),
        emptyLine(),
        makeTable(["Code", "Language", "Coverage"], [
          ["ko", "Korean", "Full (default)"],
          ["en", "English", "Full"],
        ], [1500, 2000, 5526]),

        heading2("Implementation"),
        bullet([boldText("Approach: "), normalText("Flat key-value dictionary in i18n.ts")]),
        bullet([boldText("State: "), normalText("React Context (i18n-context.tsx) + localStorage persistence")]),
        bullet([boldText("Scope: "), normalText("UI labels, tooltips, agent sidebar, error messages, placeholders")]),
        bullet([boldText("Agent Language: "), normalText("Language parameter sent to API; English mode prepends instruction to force English responses from all agents")]),
        emptyLine(),
        para("No URL-based locale routing or heavyweight i18n libraries \u2014 a lightweight approach suited for a bilingual application."),

        // ════════════════════ FOOTER ════════════════════
        emptyLine(), emptyLine(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 1, color: GRAY_200, space: 8 } },
          spacing: { before: 400 },
          children: [new TextRun({ text: "My Offer Agent", bold: true, font: "Arial", size: 20, color: GRAY_500 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [new TextRun({ text: "Developed by Chanjoong Kim", font: "Arial", size: 18, color: GRAY_500 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "chanjoongx@gmail.com  |  github.com/chanjoongx/myofferagent", font: "Arial", size: 18, color: GRAY_500 })],
        }),
      ],
    },
  ],
});

// ── Generate ──
const buffer = await Packer.toBuffer(doc);
const outPath = resolve(__dirname, "MyOfferAgent-Guide.docx");
writeFileSync(outPath, buffer);
console.log("DOCX generated:", outPath);
console.log("Size:", (buffer.length / 1024).toFixed(1), "KB");
