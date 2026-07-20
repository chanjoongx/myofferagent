import { chromium } from "playwright";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap');

* {
    font-family: 'Inter', 'Noto Sans KR', sans-serif;
    box-sizing: border-box;
}
body {
    font-size: 11pt;
    line-height: 1.7;
    color: #1F2937;
    max-width: 780px;
    margin: 0 auto;
    padding: 40px;
}
h1 {
    color: #0F766E;
    font-size: 22pt;
    border-bottom: 2px solid #14B8A6;
    padding-bottom: 8px;
    margin-top: 0;
    margin-bottom: 20px;
}
h2 {
    color: #0F766E;
    font-size: 14pt;
    margin-top: 28px;
    margin-bottom: 8px;
}

/* ===== COVER ===== */
.cover {
    text-align: center;
    padding: 60px 0 40px;
}
.cover h1 {
    font-size: 28pt;
    border: none;
    color: #0F766E;
    margin-bottom: 8px;
}
.cover .subtitle {
    font-size: 15pt;
    color: #6B7280;
    margin-bottom: 30px;
}
.cover .info {
    font-size: 12pt;
    color: #4B5563;
    margin-top: 16px;
}
.cover .version {
    margin-top: 40px;
    color: #9CA3AF;
    font-size: 10pt;
}
.page-break {
    page-break-after: always;
}

/* ===== SLIDE HEADER ===== */
.slide-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 2px solid #0F766E;
}
.slide-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: #0F766E;
    color: white;
    border-radius: 50%;
    font-weight: 800;
    font-size: 16pt;
    flex-shrink: 0;
}
.slide-title {
    font-size: 16pt;
    font-weight: 700;
    color: #1F2937;
}
.slide-file {
    font-size: 9pt;
    color: #9CA3AF;
    font-family: 'Consolas', monospace;
}
.timing {
    display: inline-block;
    background: #EDE9FE;
    color: #6D28D9;
    border-radius: 6px;
    padding: 2px 10px;
    font-size: 9pt;
    font-weight: 600;
    margin-left: auto;
}

/* ===== KEYWORDS — the big thing to memorize ===== */
.keywords {
    display: flex;
    gap: 10px;
    margin: 12px 0 6px;
    flex-wrap: wrap;
}
.keywords .kw {
    background: #0F766E;
    color: white;
    padding: 6px 16px;
    border-radius: 20px;
    font-weight: 700;
    font-size: 12pt;
    letter-spacing: 0.3px;
}
.keywords-label {
    font-size: 8pt;
    font-weight: 700;
    color: #6B7280;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 10px;
    margin-bottom: 2px;
}

/* ===== SAY THIS — the actual lines ===== */
.say-box {
    background: #F0FDF4;
    border: 2px solid #86EFAC;
    border-radius: 10px;
    padding: 16px 20px;
    margin: 10px 0;
    line-height: 1.9;
    font-size: 11.5pt;
}
.say-box::before {
    content: "🎤 SAY THIS";
    display: inline-block;
    background: #DCFCE7;
    color: #166534;
    border-radius: 4px;
    padding: 2px 10px;
    font-size: 8pt;
    font-weight: 800;
    margin-bottom: 8px;
    letter-spacing: 0.5px;
}
.say-box p {
    margin: 6px 0;
}
.say-box .key {
    color: #166534;
    font-weight: 700;
    background: #DCFCE7;
    padding: 1px 4px;
    border-radius: 3px;
}

/* ===== TRANSITION — connecting to next slide ===== */
.transition {
    background: #FEF3C7;
    border: 1px solid #FDE68A;
    border-radius: 8px;
    padding: 10px 16px;
    margin: 8px 0;
    font-size: 10.5pt;
    color: #92400E;
}
.transition::before {
    content: "➡️ TRANSITION";
    display: inline-block;
    background: #FEF9C3;
    color: #A16207;
    border-radius: 4px;
    padding: 1px 8px;
    font-size: 8pt;
    font-weight: 800;
    margin-bottom: 4px;
    margin-right: 6px;
    letter-spacing: 0.5px;
}

/* ===== ACTION — physical action ===== */
.action {
    background: #FFF7ED;
    border: 1px solid #FED7AA;
    border-radius: 8px;
    padding: 10px 16px;
    margin: 8px 0;
    font-size: 10pt;
    color: #9A3412;
}
.action::before {
    content: "👉 DO THIS";
    display: inline-block;
    background: #FFEDD5;
    color: #C2410C;
    border-radius: 4px;
    padding: 1px 8px;
    font-size: 8pt;
    font-weight: 800;
    margin-bottom: 4px;
    margin-right: 6px;
    letter-spacing: 0.5px;
}

/* ===== KR NOTE — Korean reference ===== */
.kr-note {
    background: #F8FAFC;
    border-left: 3px solid #CBD5E1;
    padding: 10px 16px;
    margin: 8px 0;
    font-size: 9.5pt;
    color: #64748B;
    font-family: 'Noto Sans KR', sans-serif;
}
.kr-note::before {
    content: "🇰🇷 참고";
    display: inline-block;
    background: #F1F5F9;
    color: #475569;
    border-radius: 4px;
    padding: 1px 8px;
    font-size: 8pt;
    font-weight: 700;
    margin-bottom: 4px;
    margin-right: 6px;
}

/* ===== TIP — presentation tips ===== */
.tip {
    background: #EFF6FF;
    border: 1px solid #BFDBFE;
    border-radius: 8px;
    padding: 10px 16px;
    margin: 8px 0;
    font-size: 10pt;
    color: #1E40AF;
}
.tip::before {
    content: "💡 TIP";
    display: inline-block;
    background: #DBEAFE;
    color: #1D4ED8;
    border-radius: 4px;
    padding: 1px 8px;
    font-size: 8pt;
    font-weight: 800;
    margin-bottom: 4px;
    margin-right: 6px;
}

/* ===== TABLE ===== */
table {
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
    font-size: 10pt;
    page-break-inside: avoid;
}
th {
    background: #0F766E;
    color: white;
    padding: 8px 12px;
    text-align: left;
}
td {
    padding: 8px 12px;
    border-bottom: 1px solid #E5E7EB;
}
tr:nth-child(even) {
    background: #F9FAFB;
}

/* ===== CHEAT SHEET ===== */
.cheat-sheet {
    background: #FFFBEB;
    border: 2px solid #FCD34D;
    border-radius: 12px;
    padding: 20px 24px;
    margin: 16px 0;
}
.cheat-sheet h3 {
    color: #92400E;
    margin: 0 0 12px;
    font-size: 13pt;
}
.cheat-row {
    display: flex;
    gap: 8px;
    align-items: baseline;
    margin: 6px 0;
    font-size: 10.5pt;
}
.cheat-slide {
    font-weight: 800;
    color: #0F766E;
    min-width: 28px;
}
.cheat-kw {
    font-weight: 600;
    color: #1F2937;
}
.cheat-line {
    color: #6B7280;
    font-style: italic;
    font-size: 9.5pt;
}

.footer {
    text-align: center;
    color: #9CA3AF;
    font-size: 9pt;
    margin-top: 40px;
    padding-top: 15px;
    border-top: 1px solid #E5E7EB;
}
h1, h2, .slide-header {
    page-break-after: avoid;
}
.say-box, .action, .transition, .tip, .kr-note, table, .cheat-sheet {
    page-break-inside: avoid;
}
</style>
</head>
<body>

<!-- ==================== COVER ==================== -->
<div class="cover">
<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBmaWxsPSJub25lIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzBmNzY2ZSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMxNGI4YTYiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImJvbHQiIHgxPSIwLjMiIHkxPSIwIiB4Mj0iMC43IiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNmZmZmZmYiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZjBmZGZhIi8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcng9IjEwOCIgZmlsbD0idXJsKCNiZykiLz4KICA8cGF0aCBkPSJNMjgwIDk2TDE2OCAyODhoNzJsLTI0IDEyOCAxMTItMTkyaC03MkwyODAgOTZ6IiBmaWxsPSJ1cmwoI2JvbHQpIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K" width="60" style="margin-bottom: 12px;" />
<h1>Presentation Script</h1>
<div class="subtitle">My Offer Agent — AI Career Pipeline</div>
<div class="info">
<p>2026 Global PBL 1st Hackathon | Irvine, CA</p>
<p style="margin-top: 8px;">Presenter: Chanjoong Kim</p>
</div>
<div class="version">10 Slides | 8–10 min | English presentation with Korean notes</div>
</div>

<div class="page-break"></div>

<!-- ==================== CHEAT SHEET ==================== -->
<h1>⚡ Quick Cheat Sheet — One Page Memory Map</h1>
<p style="color:#6B7280; font-size:10pt; margin-top:-8px;">이 한 페이지만 머릿속에 넣으세요. 키워드 3개 → 자연스럽게 나옴.</p>

<div class="cheat-sheet">
<h3>🧠 Keyword → First Sentence (이것만 기억하면 나머지는 나옴)</h3>

<div class="cheat-row">
<span class="cheat-slide">1.</span>
<span class="cheat-kw">Name · My Offer Agent · Conversational</span>
</div>
<div class="cheat-row">
<span class="cheat-slide"></span>
<span class="cheat-line">"Hi, I'm CJ. Today I'll show you My Offer Agent."</span>
</div>

<div class="cheat-row">
<span class="cheat-slide">2.</span>
<span class="cheat-kw">QR · myofferagent.com · Try it now</span>
</div>
<div class="cheat-row">
<span class="cheat-slide"></span>
<span class="cheat-line">"Before I start — scan this QR or go to myofferagent.com."</span>
</div>

<div class="cheat-row">
<span class="cheat-slide">3.</span>
<span class="cheat-kw">5 tools · Copy-paste · One chat, 6 agents</span>
</div>
<div class="cheat-row">
<span class="cheat-slide"></span>
<span class="cheat-line">"Job seekers currently juggle at least 5 different tools."</span>
</div>

<div class="cheat-row">
<span class="cheat-slide">4.</span>
<span class="cheat-kw">Sidebar · Auto-routing · Dark/EN</span>
</div>
<div class="cheat-row">
<span class="cheat-slide"></span>
<span class="cheat-line">"This is the actual interface. Notice the pipeline on the left."</span>
</div>

<div class="cheat-row">
<span class="cheat-slide">5.</span>
<span class="cheat-kw">Regex→LLM · 60% saved · Handoff</span>
</div>
<div class="cheat-row">
<span class="cheat-slide"></span>
<span class="cheat-line">"The core is a two-stage routing system."</span>
</div>

<div class="cheat-row">
<span class="cheat-slide">6.</span>
<span class="cheat-kw">Triage greets · Auto switch · User doesn't know</span>
</div>
<div class="cheat-row">
<span class="cheat-slide"></span>
<span class="cheat-line">"Let me walk you through the conversation flow."</span>
</div>

<div class="cheat-row">
<span class="cheat-slide">7.</span>
<span class="cheat-kw">Client-side · Zero privacy risk · ATS 100pt</span>
</div>
<div class="cheat-row">
<span class="cheat-slide"></span>
<span class="cheat-line">"When you upload a resume, parsing is fully client-side."</span>
</div>

<div class="cheat-row">
<span class="cheat-slide">8.</span>
<span class="cheat-kw">Real-time search · "Analyze #3" · Auto cover letter</span>
</div>
<div class="cheat-row">
<span class="cheat-slide"></span>
<span class="cheat-line">"Job Scout searches the internet in real time."</span>
</div>

<div class="cheat-row">
<span class="cheat-slide">9.</span>
<span class="cheat-kw">Agents SDK · Cloudflare Edge · 1 week, solo</span>
</div>
<div class="cheat-row">
<span class="cheat-slide"></span>
<span class="cheat-line">"Quick overview of the tech stack."</span>
</div>

<div class="cheat-row">
<span class="cheat-slide">10.</span>
<span class="cheat-kw">myofferagent.com · GitHub · Questions?</span>
</div>
<div class="cheat-row">
<span class="cheat-slide"></span>
<span class="cheat-line">"That's My Offer Agent. Try it at myofferagent.com."</span>
</div>
</div>

<div class="tip">연습법: 키워드 3개를 보면서 1분 타이머 → 자유롭게 영어로 말하기. 3회 반복하면 자연스러워짐. 문장을 외우려 하면 오히려 어색해지니까 키워드만!</div>

<div class="page-break"></div>

<!-- ==================== SLIDE ORDER ==================== -->
<h1>Slide Order</h1>

<table>
<tr><th>#</th><th>Slide</th><th>File</th><th>Time</th><th>Key Point</th></tr>
<tr><td>1</td><td>Cover</td><td>cover.png</td><td>30s</td><td>Intro — name + one-liner</td></tr>
<tr><td>2</td><td>Domain (QR)</td><td>domain.png</td><td>30s</td><td>Live access — scan QR</td></tr>
<tr><td>3</td><td>The Problem</td><td>problem.png</td><td>1m</td><td>Problem → Solution</td></tr>
<tr><td>4</td><td>UI Demo</td><td>agent_dark.png</td><td>1m</td><td>Interface walkthrough</td></tr>
<tr><td>5</td><td>Architecture</td><td>architecture.png</td><td>1m 30s</td><td>2-stage routing + handoff</td></tr>
<tr><td>6</td><td>Chat Demo</td><td>chat_demo.png</td><td>1m</td><td>Conversation flow</td></tr>
<tr><td>7</td><td>Resume Demo</td><td>resume_demo.png</td><td>1m</td><td>Client-side + ATS score</td></tr>
<tr><td>8</td><td>Job Demo</td><td>job_demo_blurred.png</td><td>1m</td><td>Search → Match → Apply</td></tr>
<tr><td>9</td><td>Tech Stack</td><td>techstack.png</td><td>1m</td><td>Stack + "1 week solo"</td></tr>
<tr><td>10</td><td>Thank You</td><td>thankyou.png</td><td>30s</td><td>CTA + Q&A</td></tr>
</table>

<div class="page-break"></div>

<!-- ==================== SLIDE 1: COVER ==================== -->
<div class="slide-header">
<span class="slide-num">1</span>
<div>
<div class="slide-title">Cover</div>
<div class="slide-file">cover.png</div>
</div>
<span class="timing">~30s</span>
</div>

<div class="keywords-label">KEYWORDS</div>
<div class="keywords">
<span class="kw">Name</span>
<span class="kw">My Offer Agent</span>
<span class="kw">Conversational</span>
</div>

<div class="say-box">
<p>Hi, I'm <span class="key">CJ</span> — Chanjoong Kim.</p>
<p>Today I'll show you <span class="key">My Offer Agent</span>.</p>
<p>It's a <span class="key">conversational career pipeline</span> — AI agents that help you through every step of job preparation, all in one chat.</p>
</div>

<div class="kr-note">안녕하세요, CJ입니다. 오늘 My Offer Agent를 소개합니다. 대화형 커리어 파이프라인입니다.</div>

<div class="transition">"Before I dive in — let me show you something."<br>→ walk to laptop, next slide</div>

<div class="page-break"></div>

<!-- ==================== SLIDE 2: DOMAIN (QR) ==================== -->
<div class="slide-header">
<span class="slide-num">2</span>
<div>
<div class="slide-title">Domain — Try It Now</div>
<div class="slide-file">domain.png</div>
</div>
<span class="timing">~30s</span>
</div>

<div class="keywords-label">KEYWORDS</div>
<div class="keywords">
<span class="kw">QR</span>
<span class="kw">myofferagent.com</span>
<span class="kw">Try it now</span>
</div>

<div class="say-box">
<p>You can <span class="key">try it live</span> while I present.</p>
<p>Scan the QR code, or just go to <span class="key">myofferagent.com</span>.</p>
<p>Pull it up on your phone right now — you can follow along with every feature I show.</p>
</div>

<div class="kr-note">발표 들으시면서 직접 체험해보세요. QR 스캔하거나 myofferagent.com 접속하세요.</div>

<div class="action">Pause ~10 seconds. Look at audience. "Got it? Once you're in, tap Start."</div>

<div class="tip">인터넷 안 되면: "Feel free to try it later — the URL is on every slide."</div>

<div class="transition">"So — why does this exist? Let me show you the problem."<br>→ next slide</div>

<div class="page-break"></div>

<!-- ==================== SLIDE 3: PROBLEM ==================== -->
<div class="slide-header">
<span class="slide-num">3</span>
<div>
<div class="slide-title">The Problem</div>
<div class="slide-file">problem.png</div>
</div>
<span class="timing">~1 min</span>
</div>

<div class="keywords-label">KEYWORDS</div>
<div class="keywords">
<span class="kw">5 tools</span>
<span class="kw">Copy-paste hell</span>
<span class="kw">One chat, 6 agents</span>
</div>

<div class="say-box">
<p>If you've ever job-hunted, you know the pain.</p>
<p>Resume in one app. Jobs on LinkedIn and Indeed. ATS score on another site. Cover letter — copy-paste into ChatGPT.</p>
<p>At least <span class="key">5 different tools</span>. Constant copy-pasting. No data connection between them.</p>
</div>

<div class="say-box">
<p>My Offer Agent solves this with <span class="key">one chat, six AI agents</span>.</p>
<p>Triage figures out what you need. Builder writes your resume. Analyzer scores it. Scout finds jobs. Match analyzes fit. Writer drafts your cover letter.</p>
<p><span class="key">No app-switching. No copy-pasting.</span> Just tell it what you need.</p>
</div>

<div class="kr-note">취업 준비할 때 최소 5개 도구 오가면서 복붙. My Offer Agent는 하나의 채팅에 6개 에이전트로 해결.</div>

<div class="transition">"Let me show you what this actually looks like."<br>→ next slide</div>

<div class="page-break"></div>

<!-- ==================== SLIDE 4: UI DEMO ==================== -->
<div class="slide-header">
<span class="slide-num">4</span>
<div>
<div class="slide-title">UI Demo — Agent Interface</div>
<div class="slide-file">agent_dark.png</div>
</div>
<span class="timing">~1 min</span>
</div>

<div class="keywords-label">KEYWORDS</div>
<div class="keywords">
<span class="kw">Sidebar pipeline</span>
<span class="kw">Auto-routing</span>
<span class="kw">Dark / English</span>
</div>

<div class="say-box">
<p>This is the <span class="key">actual interface</span>.</p>
<p>On the left — the <span class="key">6-agent pipeline</span>. You can see which agent is active and how far you've progressed.</p>
<p>On the right — just a chat. Type anything, and the system <span class="key">automatically routes</span> you to the right agent.</p>
<p>You can also click agents manually, and we support <span class="key">dark mode</span> and <span class="key">English/Korean</span> toggle.</p>
</div>

<div class="kr-note">왼쪽 사이드바에 6개 파이프라인, 오른쪽에 채팅. 자동 라우팅 + 다크모드/영어 지원.</div>

<div class="action">To audience: "If you've opened the app, you should see this screen right now."</div>

<div class="transition">"Now let me explain how this works under the hood."<br>→ next slide</div>

<div class="page-break"></div>

<!-- ==================== SLIDE 5: ARCHITECTURE ==================== -->
<div class="slide-header">
<span class="slide-num">5</span>
<div>
<div class="slide-title">Architecture</div>
<div class="slide-file">architecture.png</div>
</div>
<span class="timing">~1 min 30s</span>
</div>

<div class="keywords-label">KEYWORDS</div>
<div class="keywords">
<span class="kw">Regex → LLM</span>
<span class="kw">60% cost cut</span>
<span class="kw">Handoff</span>
</div>

<div class="say-box">
<p>The core is <span class="key">multi-agent orchestration</span> with the OpenAI Agents SDK.</p>
<p>When a message comes in, the server first tries <span class="key">regex pattern matching</span>. "Find me jobs" → Job Scout. "Analyze my resume" → Analyzer. Instant. No LLM needed.</p>
<p>Only when intent is <span class="key">unclear</span> does the Triage Agent use the LLM to decide.</p>
</div>

<div class="say-box">
<p>Why this <span class="key">two-stage routing</span>?</p>
<p>LLM-only routing was <span class="key">non-deterministic</span> — sometimes sent users to the wrong agent. Regex pre-routing fixed accuracy and <span class="key">cut LLM costs ~60%</span>.</p>
<p>Agent transitions use the SDK's <span class="key">handoff</span> — automatic context transfer, zero custom code.</p>
</div>

<div class="kr-note">정규식 먼저 → LLM 나중 = 2단계 라우팅. 정확도↑ + 비용 60% 절감. SDK handoff로 자동 전환.</div>

<div class="transition">"Let me show you this in action with a real conversation."<br>→ next slide</div>

<div class="page-break"></div>

<!-- ==================== SLIDE 6: CHAT DEMO ==================== -->
<div class="slide-header">
<span class="slide-num">6</span>
<div>
<div class="slide-title">Chat Demo — Smart Conversation</div>
<div class="slide-file">chat_demo.png</div>
</div>
<span class="timing">~1 min</span>
</div>

<div class="keywords-label">KEYWORDS</div>
<div class="keywords">
<span class="kw">Triage greets</span>
<span class="kw">Auto switch</span>
<span class="kw">User doesn't know</span>
</div>

<div class="say-box">
<p>Here's the <span class="key">actual conversation flow</span>.</p>
<p>Triage greets you: "Do you have a resume?" Based on your answer, it <span class="key">automatically connects</span> you to the right agent.</p>
<p>Say "find me jobs" — <span class="key">Job Scout activates</span> instantly. You can see it change in the sidebar.</p>
<p>The key point: all transitions are <span class="key">automatic</span>. Users never need to know which agent they're talking to.</p>
</div>

<div class="kr-note">Triage가 인사 → 자동 연결. "채용공고 찾아줘" → Job Scout 즉시 활성화. 사용자는 에이전트 몰라도 됨.</div>

<div class="transition">"Now let me show you the resume analysis."<br>→ next slide</div>

<div class="page-break"></div>

<!-- ==================== SLIDE 7: RESUME DEMO ==================== -->
<div class="slide-header">
<span class="slide-num">7</span>
<div>
<div class="slide-title">Resume Demo — ATS Analysis</div>
<div class="slide-file">resume_demo.png</div>
</div>
<span class="timing">~1 min</span>
</div>

<div class="keywords-label">KEYWORDS</div>
<div class="keywords">
<span class="kw">Client-side parsing</span>
<span class="kw">Zero privacy risk</span>
<span class="kw">ATS 100-point</span>
</div>

<div class="say-box">
<p>Upload a resume as PDF — here's what happens.</p>
<p>PDF parsing runs <span class="key">entirely in the browser</span>. We use pdfjs-dist on the client. Your resume <span class="key">never touches the server</span>. Zero privacy risk.</p>
<p>Then the Analyzer produces a <span class="key">100-point ATS score</span> across 6 categories — format, keywords, achievements, structure, readability, grammar.</p>
<p>Each category has a score and <span class="key">specific improvement suggestions</span>.</p>
</div>

<div class="kr-note">PDF 파싱은 100% 브라우저. 서버 노출 제로. ATS 100점 만점 + 6개 카테고리 + 개선 제안.</div>

<div class="action">"If you're following along — drag and drop your resume PDF. Try it."</div>

<div class="transition">"Once you have a strong resume, the next step is finding the right job."<br>→ next slide</div>

<div class="page-break"></div>

<!-- ==================== SLIDE 8: JOB DEMO ==================== -->
<div class="slide-header">
<span class="slide-num">8</span>
<div>
<div class="slide-title">Job Demo — Search &amp; Match</div>
<div class="slide-file">job_demo_blurred.png</div>
</div>
<span class="timing">~1 min</span>
</div>

<div class="keywords-label">KEYWORDS</div>
<div class="keywords">
<span class="kw">Real-time search</span>
<span class="kw">"Analyze #3"</span>
<span class="kw">Auto cover letter</span>
</div>

<div class="say-box">
<p>Job Scout does <span class="key">real-time web search</span> — not a stored database. It searches the internet right now.</p>
<p>Results come back numbered. Say <span class="key">"analyze number 3"</span> — Match agent activates. It compares your resume to that job: match score, keyword gaps, skill fit.</p>
<p>Then say "I want to apply" — <span class="key">Application Writer</span> auto-generates a tailored cover letter and optimized resume.</p>
<p><span class="key">Search → analyze → apply.</span> All in one conversation.</p>
</div>

<div class="kr-note">실시간 검색 → "3번 분석해줘" → 매칭 → "지원할게" → 커버레터+이력서 자동 생성. 하나의 대화에서 완결.</div>

<div class="transition">"Let me quickly cover the tech behind all this."<br>→ next slide</div>

<div class="page-break"></div>

<!-- ==================== SLIDE 9: TECH STACK ==================== -->
<div class="slide-header">
<span class="slide-num">9</span>
<div>
<div class="slide-title">Tech Stack</div>
<div class="slide-file">techstack.png</div>
</div>
<span class="timing">~1 min</span>
</div>

<div class="keywords-label">KEYWORDS</div>
<div class="keywords">
<span class="kw">Agents SDK</span>
<span class="kw">Cloudflare Edge</span>
<span class="kw">1 week, solo</span>
</div>

<div class="say-box">
<p>Quick tech overview.</p>
<p>AI: <span class="key">OpenAI Agents SDK</span> with GPT-4o and GPT-4o-mini. Development with <span class="key">Claude Code</span>.</p>
<p>Frontend: <span class="key">Next.js 16</span>, Tailwind v4, TypeScript.</p>
<p>Deployed on <span class="key">Cloudflare Pages</span> — edge runtime. OpenNext adapter converts Next.js to Workers.</p>
</div>

<div class="say-box">
<p>Technical challenges worth mentioning:</p>
<p>Edge runtime has no Node.js APIs — solved with <span class="key">AsyncLocalStorage polyfill</span>.</p>
<p>Agent handoffs were non-deterministic — solved with <span class="key">regex pre-routing</span>.</p>
<p>And — this was built in <span class="key">one week, solo</span>. Planning, design, development, deployment. All by myself.</p>
</div>

<div class="kr-note">Agents SDK + GPT-4o, Next.js 16, Cloudflare Edge. 기술적 도전: Edge 호환성 + 비결정적 핸드오프 → 해결. 1주일 혼자 완성.</div>

<div class="tip">"One week, solo" — 이 문장에서 잠깐 멈추고 청중 눈 마주치기. 가장 임팩트 있는 순간.</div>

<div class="transition">"And that's My Offer Agent."<br>→ walk to laptop, last slide</div>

<div class="page-break"></div>

<!-- ==================== SLIDE 10: THANK YOU ==================== -->
<div class="slide-header">
<span class="slide-num">10</span>
<div>
<div class="slide-title">Thank You</div>
<div class="slide-file">thankyou.png</div>
</div>
<span class="timing">~30s</span>
</div>

<div class="keywords-label">KEYWORDS</div>
<div class="keywords">
<span class="kw">myofferagent.com</span>
<span class="kw">GitHub</span>
<span class="kw">Questions?</span>
</div>

<div class="say-box">
<p>That's <span class="key">My Offer Agent</span>.</p>
<p>Try it at <span class="key">myofferagent.com</span>. Full source code is on <span class="key">GitHub</span>.</p>
<p>Thank you. I'm happy to take any questions.</p>
</div>

<div class="kr-note">myofferagent.com에서 직접 체험, GitHub에서 소스 확인 가능. 감사합니다, 질문 받겠습니다.</div>

<div class="page-break"></div>

<!-- ==================== Q&A APPENDIX ==================== -->
<h1>Appendix: Q&A Prep</h1>
<p style="color:#6B7280; font-size:10pt;">예상 질문 5개. 영어 답변 위주, 한국어 참고.</p>

<h2>Q1. "Why OpenAI Agents SDK?"</h2>
<div class="say-box">
<p>The hardest part of multi-agent systems is <span class="key">handoffs and context</span>.</p>
<p>Agents SDK solves this with a single <span class="key">handoff() call</span>. What would be hundreds of lines of custom orchestration — the SDK handles it.</p>
</div>
<div class="kr-note">핸드오프+컨텍스트 유지가 가장 어려운데, SDK가 handoff() 한 줄로 해결.</div>

<h2>Q2. "How do you manage API costs?"</h2>
<div class="say-box">
<p>Two strategies. <span class="key">Regex pre-routing</span> — clear intents skip the LLM entirely. Cut Triage calls by ~60%.</p>
<p><span class="key">Model tiering</span> — GPT-4o for analysis, GPT-4o-mini for fast tasks like parsing.</p>
</div>
<div class="kr-note">정규식 프리라우팅으로 60% 절감 + 모델 분리(4o vs 4o-mini).</div>

<h2>Q3. "Resume data privacy?"</h2>
<div class="say-box">
<p>PDF parsing is <span class="key">100% browser-side</span>. pdfjs-dist runs on the client.</p>
<p>Only extracted text goes to OpenAI for analysis. <span class="key">Nothing stored</span> in any database.</p>
</div>
<div class="kr-note">PDF 파싱은 브라우저에서. 추출된 텍스트만 API로. DB 저장 없음.</div>

<h2>Q4. "How did you build this in one week?"</h2>
<div class="say-box">
<p><span class="key">Claude Code</span> for AI pair programming — architecture, code gen, debugging, refactoring.</p>
<p>Agents SDK minimized orchestration code. Tailwind v4's CSS-first approach cut styling time.</p>
</div>
<div class="kr-note">Claude Code AI 페어 프로그래밍 + Agents SDK로 오케스트레이션 최소화 + Tailwind v4.</div>

<h2>Q5. "Future plans?"</h2>
<div class="say-box">
<p>Next: <span class="key">Interview Prep Agent</span> as the 7th agent.</p>
<p>Then: user auth, conversation history, resume versioning — evolving toward a production service.</p>
</div>
<div class="kr-note">7번째 에이전트 Interview Prep 추가 → 인증, 대화 기록, 이력서 버전 관리.</div>

<div class="footer">
<p><strong>My Offer Agent</strong> — Presentation Script v3.0 (English-first + Korean notes)</p>
<p>Chanjoong Kim | chanjoongx@gmail.com</p>
</div>

</body>
</html>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: "networkidle" });

  const outPath = resolve(__dirname, "Presentation-Script.pdf");
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
