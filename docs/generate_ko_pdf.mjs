import { chromium } from "playwright";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
* {
    font-family: 'Noto Sans CJK KR', 'Malgun Gothic', sans-serif;
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

<!-- ==================== \uD45C\uC9C0 ==================== -->
<div class="cover">
<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBmaWxsPSJub25lIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzBmNzY2ZSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMxNGI4YTYiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImJvbHQiIHgxPSIwLjMiIHkxPSIwIiB4Mj0iMC43IiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNmZmZmZmYiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZjBmZGZhIi8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcng9IjEwOCIgZmlsbD0idXJsKCNiZykiLz4KICA8cGF0aCBkPSJNMjgwIDk2TDE2OCAyODhoNzJsLTI0IDEyOCAxMTItMTkyaC03MkwyODAgOTZ6IiBmaWxsPSJ1cmwoI2JvbHQpIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K" width="80" style="margin-bottom: 20px;" />
<h1>My Offer Agent</h1>
<div class="subtitle">AI \uAE30\uBC18 \uCDE8\uC5C5 \uD30C\uC774\uD504\uB77C\uC778</div>
<p style="margin-top: 30px;">\uAE30\uC220 \uAC00\uC774\uB4DC\uBD81 &amp; \uD504\uB85C\uC81D\uD2B8 \uBB38\uC11C</p>
<p style="margin-top: 20px; font-size: 12pt; color: #4B5563;">\uAE40\uCC2C\uC911 (Chanjoong Kim)</p>
<p style="font-size: 10pt; color: #6B7280;">chanjoongx@gmail.com</p>
<div class="version">\uBC84\uC804 1.0.0 | 2026\uB144 3\uC6D4</div>

<table class="info-table" style="margin-top: 60px;">
<tr><th colspan="2" style="text-align: center;">\uD504\uB85C\uC81D\uD2B8 \uC815\uBCF4</th></tr>
<tr><td><strong>\uB370\uBAA8</strong></td><td>myofferagent.com</td></tr>
<tr><td><strong>\uAE30\uC220 \uC2A4\uD0DD</strong></td><td>Next.js 16, OpenAI Agents SDK, Tailwind CSS v4</td></tr>
<tr><td><strong>\uBC30\uD3EC</strong></td><td>Cloudflare Pages</td></tr>
<tr><td><strong>\uB77C\uC774\uC120\uC2A4</strong></td><td>MIT</td></tr>
</table>
</div>

<div class="page-break"></div>

<!-- ==================== \uBAA9\uCC28 ==================== -->
<h1>\uBAA9\uCC28</h1>
<ol>
<li>\uD504\uB85C\uC81D\uD2B8 \uAC1C\uC694</li>
<li>\uD575\uC2EC \uAE30\uB2A5</li>
<li>\uC5D0\uC774\uC804\uD2B8 \uC544\uD0A4\uD14D\uCC98</li>
<li>\uB3C4\uAD6C \uC815\uC758</li>
<li>API \uC124\uACC4</li>
<li>\uAE30\uC220 \uC544\uD0A4\uD14D\uCC98</li>
<li>ATS \uC810\uC218 \uC2DC\uC2A4\uD15C</li>
<li>\uBC30\uD3EC</li>
<li>\uB2E4\uAD6D\uC5B4 \uC9C0\uC6D0</li>
</ol>

<div class="page-break"></div>

<!-- ==================== 1. \uD504\uB85C\uC81D\uD2B8 \uAC1C\uC694 ==================== -->
<h1>1. \uD504\uB85C\uC81D\uD2B8 \uAC1C\uC694</h1>

<h2>My Offer Agent\uB780?</h2>
<p>My Offer Agent\uB294 \uCDE8\uC5C5 \uC900\uBE44\uC790\uAC00 \uC774\uB825\uC11C \uC791\uC131\uBD80\uD130 \uCC44\uC6A9\uACF5\uACE0 \uAC80\uC0C9, \uB9DE\uCDA4\uD615 \uC9C0\uC6D0\uC11C\uB958 \uC900\uBE44\uAE4C\uC9C0 \uC804\uCCB4 \uC9C0\uC6D0 \uD504\uB85C\uC138\uC2A4\uB97C \uD558\uB098\uC758 \uCC44\uD305 \uC778\uD130\uD398\uC774\uC2A4\uC5D0\uC11C \uAD00\uB9AC\uD560 \uC218 \uC788\uB294 \uB300\uD654\uD615 AI \uD50C\uB7AB\uD3FC\uC785\uB2C8\uB2E4. 6\uAC1C\uC758 \uC804\uBB38 AI \uC5D0\uC774\uC804\uD2B8\uAC00 \uD611\uB825\uD558\uC5EC \uC791\uB3D9\uD569\uB2C8\uB2E4.</p>

<p><strong>\uC8FC\uC694 \uAE30\uB2A5:</strong></p>
<ul>
<li>\uC790\uB3D9 \uD578\uB4DC\uC624\uD504\uB97C \uC9C0\uC6D0\uD558\uB294 6\uAC1C \uC804\uBB38 AI \uC5D0\uC774\uC804\uD2B8</li>
<li>\uC6F9 \uAC80\uC0C9 API\uB97C \uD1B5\uD55C \uC2E4\uC2DC\uAC04 \uCC44\uC6A9\uACF5\uACE0 \uAC80\uC0C9</li>
<li>ATS (\uC9C0\uC6D0\uC790 \uCD94\uC801 \uC2DC\uC2A4\uD15C) 100\uC810 \uB9CC\uC810 \uC774\uB825\uC11C \uBD84\uC11D</li>
<li>\uD2B9\uC815 \uCC44\uC6A9\uACF5\uACE0\uC5D0 \uB9DE\uCDA4\uD654\uB41C \uCEE4\uBC84\uB808\uD130 \uBC0F \uC774\uB825\uC11C \uC0DD\uC131</li>
<li>\uD074\uB77C\uC774\uC5B8\uD2B8 \uCE21 PDF \uD30C\uC2F1 &mdash; \uC81C3\uC790 \uC11C\uBE44\uC2A4\uB85C \uB370\uC774\uD130 \uC804\uC1A1 \uC5C6\uC74C</li>
</ul>

<h2>\uD574\uACB0\uD558\uB294 \uBB38\uC81C</h2>
<p>\uCDE8\uC5C5 \uC900\uBE44\uC790\uB4E4\uC740 \uC774\uB825\uC11C \uBE4C\uB354, \uCC44\uC6A9 \uC0AC\uC774\uD2B8, ATS \uCCB4\uCEE4, \uCEE4\uBC84\uB808\uD130 \uC0DD\uC131\uAE30 \uB4F1 \uC5EC\uB7EC \uB3C4\uAD6C\uB97C \uB530\uB85C\uB530\uB85C \uC0AC\uC6A9\uD574\uC57C \uD569\uB2C8\uB2E4. \uAC01 \uB3C4\uAD6C\uB9C8\uB2E4 \uB2E4\uB978 \uC778\uD130\uD398\uC774\uC2A4, \uB370\uC774\uD130 \uD3EC\uB9F7, \uD559\uC2B5 \uACE1\uC120\uC774 \uC788\uC5B4 \uC2DC\uAC04\uC774 \uB0AD\uBE44\uB418\uACE0 \uC9C0\uC6D0 \uC804\uB7B5\uC5D0 \uACF5\uBC31\uC774 \uC0DD\uAE41\uB2C8\uB2E4.</p>

<p>My Offer Agent\uB294 \uC774 \uBAA8\uB4E0 \uC6CC\uD06C\uD50C\uB85C\uB97C \uD558\uB098\uC758 \uB300\uD654\uD615 \uC778\uD130\uD398\uC774\uC2A4\uB85C \uD1B5\uD569\uD569\uB2C8\uB2E4. \uC0AC\uC6A9\uC790\uB294 \uD544\uC694\uD55C \uAC83\uC744 \uC124\uBA85\uD558\uAE30\uB9CC \uD558\uBA74, \uC2DC\uC2A4\uD15C\uC774 \uC790\uB3D9\uC73C\uB85C \uC801\uC808\uD55C \uC804\uBB38 \uC5D0\uC774\uC804\uD2B8\uB85C \uB77C\uC6B0\uD305\uD569\uB2C8\uB2E4.</p>

<h2>\uB300\uC0C1 \uC0AC\uC6A9\uC790</h2>
<ul>
<li>\uC5EC\uB7EC \uD3EC\uC9C0\uC158\uC5D0 \uC9C0\uC6D0\uC11C\uB97C \uC900\uBE44\uD558\uB294 \uCDE8\uC5C5 \uC900\uBE44\uC790</li>
<li>\uCC98\uC74C \uCDE8\uC5C5 \uC2DC\uC7A5\uC5D0 \uC9C4\uC785\uD558\uB294 \uD559\uC0DD</li>
<li>\uC0C8\uB85C\uC6B4 \uBD84\uC57C\uB97C \uC704\uD574 \uC774\uB825\uC11C \uCD5C\uC801\uD654\uAC00 \uD544\uC694\uD55C \uC774\uC9C1\uD76C\uB9DD\uC790</li>
<li>\uC601\uBB38 \uC774\uB825\uC11C \uC791\uC131\uC5D0 \uB3C4\uC6C0\uC774 \uD544\uC694\uD55C \uAD6D\uC81C \uC9C0\uC6D0\uC790</li>
</ul>

<div class="page-break"></div>

<!-- ==================== 2. \uD575\uC2EC \uAE30\uB2A5 ==================== -->
<h1>2. \uD575\uC2EC \uAE30\uB2A5</h1>

<table>
<tr><th>\uAE30\uB2A5</th><th>\uC124\uBA85</th></tr>
<tr><td>\uC2A4\uB9C8\uD2B8 \uB77C\uC6B0\uD305</td><td>\uC815\uADDC\uC2DD \uC0AC\uC804 \uB77C\uC6B0\uD305 + LLM \uAE30\uBC18 \uD2B8\uB9AC\uC544\uC9C0\uB97C \uD1B5\uD55C \uC758\uB3C4 \uAC10\uC9C0 \uBC0F \uC5D0\uC774\uC804\uD2B8 \uC120\uD0DD</td></tr>
<tr><td>\uC774\uB825\uC11C \uBE4C\uB354</td><td>\uB300\uD654\uD615 \uB2E8\uACC4\uBCC4 \uC774\uB825\uC11C \uC0DD\uC131 (Markdown \uCD9C\uB825)</td></tr>
<tr><td>\uC774\uB825\uC11C \uBD84\uC11D\uAE30</td><td>6\uAC1C \uCE74\uD14C\uACE0\uB9AC 100\uC810 \uB9CC\uC810 ATS \uC810\uC218 + \uAC1C\uC120 \uD53C\uB4DC\uBC31</td></tr>
<tr><td>Job Scout</td><td>\uC0AC\uC6A9\uC790 \uD504\uB85C\uD544\uC5D0 \uB9DE\uB294 \uCC44\uC6A9\uACF5\uACE0 \uC2E4\uC2DC\uAC04 \uC6F9 \uAC80\uC0C9</td></tr>
<tr><td>Match Strategy</td><td>\uC774\uB825\uC11C vs. \uCC44\uC6A9\uACF5\uACE0 \uBD84\uC11D + \uD0A4\uC6CC\uB4DC \uAC2D \uC2DD\uBCC4</td></tr>
<tr><td>\uC9C0\uC6D0\uC11C \uC791\uC131\uAE30</td><td>\uCC44\uC6A9\uACF5\uACE0\uBCC4 \uB9DE\uCDA4 \uCEE4\uBC84\uB808\uD130 + \uCD5C\uC801\uD654\uB41C \uC774\uB825\uC11C \uBCC0\uD658</td></tr>
<tr><td>PDF \uC5C5\uB85C\uB4DC</td><td>pdfjs-dist\uB97C \uD1B5\uD55C \uD074\uB77C\uC774\uC5B8\uD2B8 \uCE21 PDF \uD30C\uC2F1 (\uC11C\uBC84 \uCC98\uB9AC \uC5C6\uC74C)</td></tr>
<tr><td>\uB2E4\uD06C/\uB77C\uC774\uD2B8 \uD14C\uB9C8</td><td>\uC2DC\uC2A4\uD15C \uC124\uC815 \uAC10\uC9C0 + \uC218\uB3D9 \uD1A0\uAE00</td></tr>
<tr><td>\uD55C\uAD6D\uC5B4/\uC601\uC5B4</td><td>\uB7F0\uD0C0\uC784 \uC5B8\uC5B4 \uC804\uD658 \uC9C0\uC6D0</td></tr>
</table>

<h2>\uC8FC\uC694 \uCC28\uBCC4\uC810</h2>
<ul>
<li><strong>\uD1B5\uD569 \uC778\uD130\uD398\uC774\uC2A4:</strong> \uBAA8\uB4E0 \uCDE8\uC5C5 \uB3C4\uAD6C\uB97C \uD558\uB098\uC758 \uCC44\uD305\uC5D0\uC11C &mdash; \uC571 \uC804\uD658 \uD544\uC694 \uC5C6\uC74C</li>
<li><strong>\uC790\uB3D9 \uC5D0\uC774\uC804\uD2B8 \uD578\uB4DC\uC624\uD504:</strong> \uC0AC\uC6A9\uC790\uB294 \uC5B4\uB5A4 \uC5D0\uC774\uC804\uD2B8\uB97C \uC0AC\uC6A9\uD560\uC9C0 \uBAB0\uB77C\uB3C4 \uB428; \uC2DC\uC2A4\uD15C\uC774 \uC9C0\uB2A5\uC801\uC73C\uB85C \uB77C\uC6B0\uD305</li>
<li><strong>\uC2E4\uC2DC\uAC04 \uCC44\uC6A9 \uB370\uC774\uD130:</strong> \uC624\uB798\uB41C \uB370\uC774\uD130\uBCA0\uC774\uC2A4\uAC00 \uC544\uB2CC \uB77C\uC774\uBE0C \uC6F9 \uAC80\uC0C9</li>
<li><strong>\uD504\uB77C\uC774\uBC84\uC2DC \uC6B0\uC120 PDF \uCC98\uB9AC:</strong> \uC774\uB825\uC11C \uD30C\uC2F1\uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uC644\uC804\uD788 \uCC98\uB9AC\uB428</li>
<li><strong>\uC624\uD508 \uC18C\uC2A4:</strong> MIT \uB77C\uC774\uC120\uC2A4\uB85C GitHub\uC5D0 \uC804\uCCB4 \uCF54\uB4DC \uACF5\uAC1C</li>
</ul>

<div class="page-break"></div>

<!-- ==================== 3. \uC5D0\uC774\uC804\uD2B8 \uC544\uD0A4\uD14D\uCC98 ==================== -->
<h1>3. \uC5D0\uC774\uC804\uD2B8 \uC544\uD0A4\uD14D\uCC98</h1>

<h2>6-\uC5D0\uC774\uC804\uD2B8 \uD30C\uC774\uD504\uB77C\uC778</h2>

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

<p>\uC2DC\uC2A4\uD15C\uC740 <strong>OpenAI Agents SDK</strong> (@openai/agents)\uB97C \uC0AC\uC6A9\uD558\uC5EC \uC790\uB3D9 \uD578\uB4DC\uC624\uD504 \uB77C\uC6B0\uD305\uC744 \uAD6C\uD604\uD569\uB2C8\uB2E4. \uAC01 \uC5D0\uC774\uC804\uD2B8\uB294 \uC790\uCCB4 \uC2DC\uC2A4\uD15C \uD504\uB86C\uD504\uD2B8, \uBAA8\uB378, \uB3C4\uAD6C, \uD578\uB4DC\uC624\uD504 \uB300\uC0C1\uC744 \uAC00\uC9C4 \uC804\uBB38 \uB2E8\uC704\uC785\uB2C8\uB2E4.</p>

<table>
<tr><th>\uC5D0\uC774\uC804\uD2B8</th><th>\uBAA8\uB378</th><th>\uB3C4\uAD6C</th><th>\uD578\uB4DC\uC624\uD504</th><th>\uC5ED\uD560</th></tr>
<tr><td>Triage</td><td>gpt-4o-mini</td><td>\uC5C6\uC74C</td><td>&rarr; Builder, Analyzer, Scout</td><td>\uC9C4\uC785\uC810. \uC758\uB3C4 \uD30C\uC545 \uD6C4 \uC804\uBB38 \uC5D0\uC774\uC804\uD2B8\uB85C \uB77C\uC6B0\uD305.</td></tr>
<tr><td>Resume Builder</td><td>gpt-4o-mini</td><td>generateResumeMD</td><td>&rarr; Analyzer</td><td>\uB300\uD654\uD615 \uC774\uB825\uC11C \uC791\uC131.</td></tr>
<tr><td>Resume Analyzer</td><td>gpt-4o</td><td>parseResume, calculateATS</td><td>&rarr; Scout</td><td>6\uAC1C \uCE74\uD14C\uACE0\uB9AC ATS \uC810\uC218 \uBD84\uC11D.</td></tr>
<tr><td>Job Scout</td><td>gpt-4o</td><td>webSearch</td><td>\uC5C6\uC74C</td><td>\uC2E4\uC2DC\uAC04 \uC6F9 \uAC80\uC0C9\uC73C\uB85C \uCC44\uC6A9\uACF5\uACE0 \uD0D0\uC0C9.</td></tr>
<tr><td>Match Strategy</td><td>gpt-4o</td><td>\uC5C6\uC74C</td><td>&rarr; Writer</td><td>\uC774\uB825\uC11C vs. \uCC44\uC6A9\uACF5\uACE0 \uC801\uD569\uC131 \uBD84\uC11D.</td></tr>
<tr><td>Application Writer</td><td>gpt-4o-mini</td><td>generateResumeMD</td><td>\uC5C6\uC74C</td><td>\uB9DE\uCDA4 \uCEE4\uBC84\uB808\uD130 + \uCD5C\uC801\uD654 \uC774\uB825\uC11C \uC0DD\uC131.</td></tr>
</table>

<h2>\uC2A4\uB9C8\uD2B8 \uB77C\uC6B0\uD305 \uB85C\uC9C1</h2>

<p>\uB77C\uC6B0\uD305\uC740 \uB450 \uB2E8\uACC4\uB85C \uC9C4\uD589\uB429\uB2C8\uB2E4:</p>

<h3>1\uB2E8\uACC4: \uC11C\uBC84 \uCE21 \uC815\uADDC\uC2DD \uC0AC\uC804 \uB77C\uC6B0\uD305</h3>
<p>LLM \uD638\uCD9C \uC804\uC5D0 API \uB77C\uC6B0\uD2B8\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uD328\uD134\uC744 \uAC80\uC0AC\uD569\uB2C8\uB2E4:</p>

<pre>
// \uC608\uC2DC \uD328\uD134 (\uD55C\uAD6D\uC5B4 + \uC601\uC5B4 \uC9C0\uC6D0)
/\uCC44\uC6A9|\uACF5\uACE0|\uAC80\uC0C9|\uCC3E\uC544|\uC7A1|\uC778\uD134/  &rarr;  Job Scout
/\uC774\uB825\uC11C.*\uB9CC\uB4E4|\uC791\uC131|\uC0DD\uC131/         &rarr;  Resume Builder
/\uC774\uB825\uC11C.*\uBD84\uC11D|ATS|\uC810\uC218/            &rarr;  Resume Analyzer
/\uCEE4\uBC84.*\uB808\uD130|\uC790\uAE30.*\uC18C\uAC1C\uC11C/           &rarr;  Application Writer
</pre>

<h3>2\uB2E8\uACC4: LLM \uAE30\uBC18 \uD2B8\uB9AC\uC544\uC9C0 (Fallback)</h3>
<p>\uC815\uADDC\uC2DD\uC73C\uB85C \uB9E4\uCE6D\uB418\uC9C0 \uC54A\uC73C\uBA74, Triage Agent\uAC00 GPT-4o-mini\uB97C \uC0AC\uC6A9\uD558\uC5EC \uBB38\uB9E5\uC744 \uC774\uD574\uD558\uACE0 \uC801\uC808\uD55C \uC804\uBB38 \uC5D0\uC774\uC804\uD2B8\uB85C \uC804\uD658\uD569\uB2C8\uB2E4.</p>

<h2>\uBAA8\uB378 \uC804\uB7B5</h2>

<table>
<tr><th>\uC791\uC5C5 \uC720\uD615</th><th>\uBAA8\uB378</th><th>\uC774\uC720</th></tr>
<tr><td>\uBE60\uB978 \uC791\uC5C5 (\uD2B8\uB9AC\uC544\uC9C0, \uBE4C\uB354, \uC791\uC131\uAE30)</td><td>gpt-4o-mini</td><td>\uB0AE\uC740 \uC9C0\uC5F0, \uB0AE\uC740 \uBE44\uC6A9, \uCDA9\uBD84\uD55C \uD488\uC9C8</td></tr>
<tr><td>\uC815\uBC00 \uC791\uC5C5 (ATS \uC810\uC218, \uB9E4\uCE6D, \uCC44\uC6A9 \uAC80\uC0C9)</td><td>gpt-4o</td><td>\uBD84\uC11D \uC791\uC5C5\uC5D0 \uB192\uC740 \uC815\uD655\uB3C4</td></tr>
</table>

<div class="page-break"></div>

<!-- ==================== 4. \uB3C4\uAD6C \uC815\uC758 ==================== -->
<h1>4. \uB3C4\uAD6C \uC815\uC758</h1>

<p>\uC5D0\uC774\uC804\uD2B8\uB294 4\uAC1C\uC758 \uB3C4\uAD6C\uB97C \uC0AC\uC6A9\uD558\uC5EC \uC678\uBD80 \uB370\uC774\uD130\uC640 \uC0C1\uD638\uC791\uC6A9\uD558\uACE0 \uC804\uBB38 \uC791\uC5C5\uC744 \uC218\uD589\uD569\uB2C8\uB2E4:</p>

<h2>parseResumeText</h2>
<table>
<tr><th>\uD56D\uBAA9</th><th>\uC138\uBD80\uC0AC\uD56D</th></tr>
<tr><td>\uC785\uB825</td><td>\uC774\uB825\uC11C \uD14D\uC2A4\uD2B8 (string) + \uC120\uD0DD\uC801 \uBAA9\uD45C \uC9C1\uBB34</td></tr>
<tr><td>\uCD9C\uB825</td><td>\uAD6C\uC870\uD654\uB41C JSON: contactInfo, education, experience, projects, skills</td></tr>
<tr><td>\uBAA8\uB378</td><td>gpt-4o-mini</td></tr>
<tr><td>\uAC80\uC99D</td><td>Zod \uC2A4\uD0A4\uB9C8 (\uB7F0\uD0C0\uC784 \uD0C0\uC785 \uAC80\uC0AC)</td></tr>
<tr><td>\uC0AC\uC6A9 \uC5D0\uC774\uC804\uD2B8</td><td>Resume Analyzer</td></tr>
</table>

<h2>calculateATSScore</h2>
<table>
<tr><th>\uD56D\uBAA9</th><th>\uC138\uBD80\uC0AC\uD56D</th></tr>
<tr><td>\uC785\uB825</td><td>ParsedResume JSON + \uBAA9\uD45C \uC9C1\uBB34</td></tr>
<tr><td>\uCD9C\uB825</td><td>ATS \uBD84\uC11D: \uC885\uD569 \uC810\uC218(0-100), 6\uAC1C \uC139\uC158 \uC810\uC218, \uAC15\uC810, \uAC1C\uC120\uC0AC\uD56D</td></tr>
<tr><td>\uBAA8\uB378</td><td>gpt-4o (\uC815\uBC00 \uBD84\uC11D\uC6A9)</td></tr>
<tr><td>\uC810\uC218 \uBC30\uBD84</td><td>\uD3EC\uB9F7(20) + \uD0A4\uC6CC\uB4DC(25) + \uC131\uACFC(20) + \uAD6C\uC870(15) + \uAC00\uB3C5\uC131(10) + \uBB38\uBC95(10) = 100</td></tr>
<tr><td>\uC0AC\uC6A9 \uC5D0\uC774\uC804\uD2B8</td><td>Resume Analyzer</td></tr>
</table>

<h2>generateResumeMarkdown</h2>
<table>
<tr><th>\uD56D\uBAA9</th><th>\uC138\uBD80\uC0AC\uD56D</th></tr>
<tr><td>\uC785\uB825</td><td>ParsedResume JSON</td></tr>
<tr><td>\uCD9C\uB825</td><td>ATS \uCD5C\uC801\uD654 Markdown \uC774\uB825\uC11C</td></tr>
<tr><td>\uBAA8\uB378</td><td>gpt-4o-mini (temperature: 0.4)</td></tr>
<tr><td>\uC0AC\uC6A9 \uC5D0\uC774\uC804\uD2B8</td><td>Resume Builder, Application Writer</td></tr>
</table>

<h2>webSearchTool</h2>
<table>
<tr><th>\uD56D\uBAA9</th><th>\uC138\uBD80\uC0AC\uD56D</th></tr>
<tr><td>\uC81C\uACF5\uC790</td><td>OpenAI \uB0B4\uC7A5 \uC6F9 \uAC80\uC0C9 \uB3C4\uAD6C</td></tr>
<tr><td>\uC785\uB825</td><td>Job Scout \uC5D0\uC774\uC804\uD2B8\uAC00 \uAD6C\uC131\uD55C \uAC80\uC0C9 \uCFFC\uB9AC</td></tr>
<tr><td>\uCD9C\uB825</td><td>\uC2E4\uC2DC\uAC04 \uC6F9 \uAC80\uC0C9 \uACB0\uACFC (\uCC44\uC6A9\uACF5\uACE0)</td></tr>
<tr><td>\uC81C\uC57D</td><td>\uD3EC\uAD04\uC801 \uACB0\uACFC\uB97C \uC704\uD574 \uC694\uCCAD\uB2F9 \uCD5C\uC18C 2\uD68C \uAC80\uC0C9</td></tr>
<tr><td>\uC0AC\uC6A9 \uC5D0\uC774\uC804\uD2B8</td><td>Job Scout</td></tr>
</table>

<div class="page-break"></div>

<!-- ==================== 5. API \uC124\uACC4 ==================== -->
<h1>5. API \uC124\uACC4</h1>

<h2>\uC5D4\uB4DC\uD3EC\uC778\uD2B8</h2>
<p><code>POST /api/agent</code></p>

<h2>\uC694\uCCAD \uC2A4\uD0A4\uB9C8</h2>
<pre>
{
  messages: Array&lt;{
    role: 'user' | 'assistant';
    content: string;
  }&gt;;
  sessionId: string;          // \uACE0\uC720 \uC138\uC158 \uC2DD\uBCC4\uC790
  resumeText?: string;        // PDF\uC5D0\uC11C \uCD94\uCD9C\uD55C \uD14D\uC2A4\uD2B8 (\uC120\uD0DD)
  lastResponseId?: string;    // \uB300\uD654 \uCCB4\uC774\uB2DD\uC6A9
  activeAgentName?: string;   // \uD604\uC7AC \uC5D0\uC774\uC804\uD2B8 \uCEE8\uD14D\uC2A4\uD2B8
  language?: 'ko' | 'en';     // \uC751\uB2F5 \uC5B8\uC5B4
}
</pre>

<h2>\uC751\uB2F5 \uC2A4\uD0A4\uB9C8</h2>
<pre>
{
  output: string;              // \uC5D0\uC774\uC804\uD2B8 \uD14D\uC2A4\uD2B8 \uC751\uB2F5
  activeAgent: string;         // \uD604\uC7AC \uD65C\uC131 \uC5D0\uC774\uC804\uD2B8 \uC774\uB984
  structuredData: {            // \uD0C0\uC785\uB41C JSON \uD398\uC774\uB85C\uB4DC
    atsAnalysis?: ATSAnalysis;
    matchAnalysis?: MatchAnalysis;
    parsedResume?: ParsedResume;
  };
  lastResponseId?: string;     // \uB2E4\uC74C \uC694\uCCAD\uC6A9
  generatedFiles?: Array&lt;{     // \uB2E4\uC6B4\uB85C\uB4DC \uAC00\uB2A5\uD55C \uD30C\uC77C
    type: string;
    content: string;
    fileName: string;
  }&gt;;
  error?: string;
}
</pre>

<h2>\uC138\uC158 \uAD00\uB9AC</h2>
<p>OpenAI\uC758 <code>previousResponseId</code> \uBA54\uCEE4\uB2C8\uC998\uC744 \uC0AC\uC6A9\uD558\uC5EC \uB300\uD654\uB97C \uCCB4\uC774\uB2DD\uD569\uB2C8\uB2E4. \uAC01 \uC751\uB2F5\uC740 <code>lastResponseId</code>\uB97C \uBC18\uD658\uD558\uACE0, \uD074\uB77C\uC774\uC5B8\uD2B8\uAC00 \uB2E4\uC74C \uC694\uCCAD\uC5D0 \uD568\uAED8 \uC804\uC1A1\uD558\uC5EC \uC11C\uBC84 \uCE21 \uC800\uC7A5 \uC5C6\uC774 \uC804\uCCB4 \uB300\uD654 \uCEE8\uD14D\uC2A4\uD2B8\uB97C \uC720\uC9C0\uD569\uB2C8\uB2E4.</p>

<h2>\uC5D0\uB7EC \uCC98\uB9AC &amp; \uC7AC\uC2DC\uB3C4</h2>
<table>
<tr><th>\uBA54\uCEE4\uB2C8\uC998</th><th>\uC138\uBD80\uC0AC\uD56D</th></tr>
<tr><td>\uC790\uB3D9 \uC7AC\uC2DC\uB3C4</td><td>2\uD68C \uC7AC\uC2DC\uB3C4 + \uC9C0\uC218 \uBC31\uC624\uD504</td></tr>
<tr><td>\uC7AC\uC2DC\uB3C4 \uD2B8\uB9AC\uAC70</td><td>HTTP 429 (\uC18D\uB3C4 \uC81C\uD55C), 5xx \uC624\uB958, \uB124\uD2B8\uC6CC\uD06C \uC7A5\uC560</td></tr>
<tr><td>\uD0C0\uC784\uC544\uC6C3</td><td>\uC5D0\uC774\uC804\uD2B8 \uC2E4\uD589\uB2F9 120\uCD08</td></tr>
<tr><td>\uAC80\uC99D</td><td>\uBAA8\uB4E0 \uB3C4\uAD6C \uC785\uCD9C\uB825\uC5D0 Zod \uC2A4\uD0A4\uB9C8 \uC801\uC6A9</td></tr>
</table>

<h2>\uC18D\uB3C4 \uC81C\uD55C</h2>
<table>
<tr><th>\uD30C\uB77C\uBBF8\uD130</th><th>\uAC12</th></tr>
<tr><td>\uCC3D</td><td>60\uCD08</td></tr>
<tr><td>\uCD5C\uB300 \uC694\uCCAD</td><td>IP\uB2F9 \uCC3D\uB2F9 20\uD68C</td></tr>
<tr><td>\uAD6C\uD604</td><td>\uC778\uBA54\uBAA8\uB9AC Map (\uC778\uC2A4\uD134\uC2A4\uB2F9)</td></tr>
<tr><td>\uBCF8\uBB38 \uD06C\uAE30 \uC81C\uD55C</td><td>500 KB</td></tr>
</table>

<div class="page-break"></div>

<!-- ==================== 6. \uAE30\uC220 \uC544\uD0A4\uD14D\uCC98 ==================== -->
<h1>6. \uAE30\uC220 \uC544\uD0A4\uD14D\uCC98</h1>

<h2>\uAE30\uC220 \uC2A4\uD0DD</h2>
<table>
<tr><th>\uACC4\uCE35</th><th>\uAE30\uC220</th><th>\uBAA9\uC801</th></tr>
<tr><td>UI \uD504\uB808\uC784\uC6CC\uD06C</td><td>Next.js 16 (App Router)</td><td>React 19 \uAE30\uBC18 \uC11C\uBC84 + \uD074\uB77C\uC774\uC5B8\uD2B8 \uB80C\uB354\uB9C1</td></tr>
<tr><td>\uC5D0\uC774\uC804\uD2B8 SDK</td><td>@openai/agents 0.6.0</td><td>\uBA40\uD2F0 \uC5D0\uC774\uC804\uD2B8 \uC624\uCF00\uC2A4\uD2B8\uB808\uC774\uC158 + \uD578\uB4DC\uC624\uD504</td></tr>
<tr><td>LLM</td><td>GPT-4o / GPT-4o-mini</td><td>\uC5B8\uC5B4 \uC774\uD574 \uBC0F \uC0DD\uC131</td></tr>
<tr><td>\uC2A4\uD0C0\uC77C\uB9C1</td><td>Tailwind CSS v4</td><td>@theme \uC124\uC815 \uAE30\uBC18 \uC720\uD2F8\uB9AC\uD2F0 CSS</td></tr>
<tr><td>PDF \uD30C\uC2F1</td><td>pdfjs-dist 5.5</td><td>\uD074\uB77C\uC774\uC5B8\uD2B8 \uCE21 PDF \uD14D\uC2A4\uD2B8 \uCD94\uCD9C</td></tr>
<tr><td>\uAC80\uC99D</td><td>Zod v4</td><td>API \uC785\uCD9C\uB825 \uB7F0\uD0C0\uC784 \uD0C0\uC785 \uAC80\uC0AC</td></tr>
<tr><td>\uCEF4\uD30C\uC77C\uB7EC</td><td>React Compiler</td><td>\uC790\uB3D9 \uBA54\uBAA8\uC774\uC81C\uC774\uC158 \uCD5C\uC801\uD654</td></tr>
<tr><td>\uB9C8\uD06C\uB2E4\uC6B4</td><td>react-markdown + remark-gfm</td><td>\uCC44\uD305\uC5D0\uC11C \uB9AC\uCE58 \uD14D\uC2A4\uD2B8 \uB80C\uB354\uB9C1</td></tr>
<tr><td>\uC544\uC774\uCF58</td><td>Lucide React</td><td>\uC77C\uAD00\uB41C \uC544\uC774\uCF58 \uC138\uD2B8</td></tr>
<tr><td>\uD638\uC2A4\uD305</td><td>Cloudflare Pages</td><td>\uAE00\uB85C\uBC8C CDN, \uC5E3\uC9C0 \uB80C\uB354\uB9C1</td></tr>
</table>

<h2>\uD504\uB85C\uC81D\uD2B8 \uAD6C\uC870</h2>
<pre>
src/
&#9500;&#9472;&#9472; app/
&#9474;   &#9500;&#9472;&#9472; page.tsx              # \uB79C\uB529 \uD398\uC774\uC9C0
&#9474;   &#9500;&#9472;&#9472; layout.tsx            # \uB8E8\uD2B8 \uB808\uC774\uC544\uC6C3 (Theme, i18n, Toast)
&#9474;   &#9500;&#9472;&#9472; agent/page.tsx        # \uCC44\uD305 \uC778\uD130\uD398\uC774\uC2A4
&#9474;   &#9492;&#9472;&#9472; api/agent/route.ts    # \uC5D0\uC774\uC804\uD2B8 API \uC5D4\uB4DC\uD3EC\uC778\uD2B8
&#9474;
&#9500;&#9472;&#9472; lib/
&#9474;   &#9500;&#9472;&#9472; agents/
&#9474;   &#9474;   &#9500;&#9472;&#9472; definitions.ts    # 6\uAC1C \uC5D0\uC774\uC804\uD2B8 \uC124\uC815
&#9474;   &#9474;   &#9500;&#9472;&#9472; tools.ts          # 3\uAC1C \uC5D0\uC774\uC804\uD2B8 \uB3C4\uAD6C
&#9474;   &#9474;   &#9500;&#9472;&#9472; model-config.ts   # GPT \uBAA8\uB378 \uC120\uD0DD
&#9474;   &#9474;   &#9492;&#9472;&#9472; constants.ts      # \uC5D0\uC774\uC804\uD2B8 \uC774\uB984 \uC0C1\uC218
&#9474;   &#9500;&#9472;&#9472; types.ts              # \uACF5\uC720 TypeScript \uD0C0\uC785
&#9474;   &#9500;&#9472;&#9472; i18n.ts               # \uBC88\uC5ED \uC0AC\uC804
&#9474;   &#9492;&#9472;&#9472; theme-context.tsx     # \uB2E4\uD06C/\uB77C\uC774\uD2B8 \uD14C\uB9C8
&#9474;
&#9492;&#9472;&#9472; components/
    &#9500;&#9472;&#9472; chat/
    &#9474;   &#9500;&#9472;&#9472; ChatInterface.tsx  # \uBA54\uC778 \uCC44\uD305 \uB85C\uC9C1
    &#9474;   &#9500;&#9472;&#9472; MessageBubble.tsx  # \uBA54\uC2DC\uC9C0 \uB80C\uB354\uB9C1
    &#9474;   &#9492;&#9472;&#9472; AgentStatusPanel.tsx  # \uD30C\uC774\uD504\uB77C\uC778 \uC0AC\uC774\uB4DC\uBC14
    &#9500;&#9472;&#9472; resume/
    &#9474;   &#9500;&#9472;&#9472; ResumeUploader.tsx # PDF \uC5C5\uB85C\uB4DC
    &#9474;   &#9492;&#9472;&#9472; ATSScoreCard.tsx   # \uC810\uC218 \uC2DC\uAC01\uD654
    &#9492;&#9472;&#9472; jobs/
        &#9492;&#9472;&#9472; JobCard.tsx         # \uCC44\uC6A9\uACF5\uACE0 \uCE74\uB4DC
</pre>

<h2>\uC8FC\uC694 \uAD6C\uD604 \uC138\uBD80\uC0AC\uD56D</h2>
<ul>
<li><strong>PDF \uCC98\uB9AC:</strong> pdfjs-dist\uB97C \uC0AC\uC6A9\uD558\uC5EC \uC644\uC804\uD788 \uD074\uB77C\uC774\uC5B8\uD2B8 \uCE21\uC5D0\uC11C \uCC98\uB9AC. \uC774\uB825\uC11C \uB370\uC774\uD130\uAC00 \uC5B4\uB5A4 \uC81C3\uC790 \uC11C\uBE44\uC2A4\uB85C\uB3C4 \uC804\uC1A1\uB418\uC9C0 \uC54A\uC74C.</li>
<li><strong>React Compiler:</strong> \uC790\uB3D9 \uBA54\uBAA8\uC774\uC81C\uC774\uC158 \uD65C\uC131\uD654 &mdash; \uC218\uB3D9 useMemo/useCallback \uBD88\uD544\uC694.</li>
<li><strong>\uC0C1\uD0DC \uBE44\uC800\uC7A5 \uBC31\uC5D4\uB4DC:</strong> \uC774\uB825\uC11C \uD14D\uC2A4\uD2B8\uB294 \uC694\uCCAD \uBCF8\uBB38\uC73C\uB85C \uC804\uB2EC. \uB370\uC774\uD130\uBCA0\uC774\uC2A4\uB098 \uD30C\uC77C \uC800\uC7A5 \uC5C6\uC74C.</li>
<li><strong>\uB300\uD654 \uCCB4\uC774\uB2DD:</strong> OpenAI\uC758 <code>previousResponseId</code>\uB85C \uC11C\uBC84 \uC0C1\uD0DC \uC5C6\uC774 \uBA40\uD2F0\uD134 \uCEE8\uD14D\uC2A4\uD2B8 \uC720\uC9C0.</li>
<li><strong>Zod \uAC80\uC99D:</strong> \uBAA8\uB4E0 \uB3C4\uAD6C \uC785\uCD9C\uB825\uC744 \uB7F0\uD0C0\uC784\uC5D0 \uAC80\uC99D\uD558\uC5EC \uBE44\uC815\uC0C1 \uB370\uC774\uD130 \uBC29\uC9C0.</li>
</ul>

<div class="page-break"></div>

<!-- ==================== 7. ATS \uC810\uC218 \uC2DC\uC2A4\uD15C ==================== -->
<h1>7. ATS \uC810\uC218 \uC2DC\uC2A4\uD15C</h1>

<p>Resume Analyzer\uB294 \uC774\uB825\uC11C\uB97C 100\uC810 \uB9CC\uC810\uC73C\uB85C 6\uAC1C \uCE74\uD14C\uACE0\uB9AC\uC5D0 \uAC78\uCCD0 \uD3C9\uAC00\uD569\uB2C8\uB2E4. \uC2E4\uC81C ATS \uC2DC\uC2A4\uD15C(Workday, Greenhouse, Lever \uB4F1)\uC774 \uC9C0\uC6D0\uC790\uB97C \uD3C9\uAC00\uD558\uB294 \uBC29\uC2DD\uC744 \uBC18\uC601\uD558\uC5EC \uC124\uACC4\uB418\uC5C8\uC2B5\uB2C8\uB2E4.</p>

<table>
<tr><th>\uCE74\uD14C\uACE0\uB9AC</th><th>\uBC30\uC810</th><th>\uD3C9\uAC00 \uD56D\uBAA9</th></tr>
<tr><td>\uD3EC\uB9F7 \uD638\uD658\uC131</td><td>20</td><td>\uAE54\uB054\uD55C \uAD6C\uC870, \uD45C\uC900 \uC139\uC158, \uD30C\uC2F1 \uAC00\uB2A5\uD55C \uB808\uC774\uC544\uC6C3, \uC77C\uAD00\uB41C \uD3EC\uB9F7\uD305</td></tr>
<tr><td>\uD0A4\uC6CC\uB4DC \uCD5C\uC801\uD654</td><td>25</td><td>\uC5C5\uACC4 \uD45C\uC900 \uC6A9\uC5B4, \uC9C1\uBB34\uBCC4 \uD0A4\uC6CC\uB4DC, \uC2A4\uD0AC-\uC9C1\uBB34 \uC815\uB82C</td></tr>
<tr><td>\uC131\uACFC \uD488\uC9C8</td><td>20</td><td>\uC815\uB7C9\uD654\uB41C \uACB0\uACFC, \uC561\uC158 \uB3D9\uC0AC, \uCE21\uC815 \uAC00\uB2A5\uD55C \uC601\uD5A5\uB825 \uC11C\uC220</td></tr>
<tr><td>\uAD6C\uC870\uC801 \uC644\uC131\uB3C4</td><td>15</td><td>\uD544\uC218 \uC139\uC158 \uC874\uC7AC: \uC5F0\uB77D\uCC98, \uD559\uB825, \uACBD\uB825, \uC2A4\uD0AC</td></tr>
<tr><td>\uAC00\uB3C5\uC131</td><td>10</td><td>\uBA85\uD655\uD55C \uC5B8\uC5B4, \uC801\uC808\uD55C \uAE38\uC774, \uB17C\uB9AC\uC801 \uD750\uB984, \uBD88\uB9BF \uD3EC\uC778\uD2B8 \uD65C\uC6A9</td></tr>
<tr><td>\uBB38\uBC95 &amp; \uB9DE\uCDA4\uBC95</td><td>10</td><td>\uC624\uB958 \uC5C6\uB294 \uAE00\uC4F0\uAE30, \uC804\uBB38\uC801 \uC5B4\uC870, \uC77C\uAD00\uB41C \uC2DC\uC81C</td></tr>
</table>

<h2>\uCD9C\uB825 \uD615\uC2DD</h2>
<p>\uAC01 \uCE74\uD14C\uACE0\uB9AC\uC5D0\uB294 \uB2E4\uC74C\uC774 \uD3EC\uD568\uB429\uB2C8\uB2E4:</p>
<ul>
<li><strong>\uC810\uC218:</strong> \uCE74\uD14C\uACE0\uB9AC \uCD5C\uB300\uC810 \uB300\uBE44 \uC218\uCE58</li>
<li><strong>\uD53C\uB4DC\uBC31:</strong> \uAD6C\uCCB4\uC801\uC778 \uAC15\uC810\uACFC \uAC1C\uC120 \uC81C\uC548</li>
<li><strong>\uC608\uC2DC:</strong> \uAD6C\uCCB4\uC801\uC778 \uCD94\uCC9C (\uC608: "Agile, Scrum, CI/CD \uD0A4\uC6CC\uB4DC \uCD94\uAC00")</li>
</ul>

<p>\uC885\uD569 \uC810\uC218\uC5D0\uB294 \uB2E4\uC74C\uB3C4 \uD3EC\uD568\uB429\uB2C8\uB2E4:</p>
<ul>
<li><strong>\uC0C1\uC704 3\uAC1C \uAC15\uC810:</strong> \uC774\uB825\uC11C\uAC00 \uC798 \uD558\uACE0 \uC788\uB294 \uBD80\uBD84</li>
<li><strong>\uC0C1\uC704 3\uAC1C \uD575\uC2EC \uAC1C\uC120\uC0AC\uD56D:</strong> \uAC00\uC7A5 \uC601\uD5A5\uB825 \uC788\uB294 \uBCC0\uACBD \uC0AC\uD56D</li>
</ul>

<div class="page-break"></div>

<!-- ==================== 8. \uBC30\uD3EC ==================== -->
<h1>8. \uBC30\uD3EC</h1>

<h2>Cloudflare Pages (\uAE30\uBCF8)</h2>

<p>\uC560\uD50C\uB9AC\uCF00\uC774\uC158\uC740 OpenNext \uC5B4\uB311\uD130\uB97C \uC0AC\uC6A9\uD558\uC5EC Cloudflare Pages\uC5D0 \uBC30\uD3EC\uB429\uB2C8\uB2E4. Next.js \uCD9C\uB825\uC744 Cloudflare Workers \uD638\uD658 \uD615\uC2DD\uC73C\uB85C \uBCC0\uD658\uD569\uB2C8\uB2E4.</p>

<table>
<tr><th>\uAD6C\uC131\uC694\uC18C</th><th>\uC138\uBD80\uC0AC\uD56D</th></tr>
<tr><td>\uC5B4\uB311\uD130</td><td>@opennextjs/cloudflare 1.17.1</td></tr>
<tr><td>\uC6CC\uCEE4</td><td>.open-next/worker.js</td></tr>
<tr><td>\uC560\uC14B</td><td>.open-next/assets/ (Cloudflare Cache)</td></tr>
<tr><td>\uD638\uD658\uC131</td><td>Node.js \uD638\uD658 \uD50C\uB798\uADF8 \uD65C\uC131\uD654</td></tr>
</table>

<h3>\uBE4C\uB4DC &amp; \uBC30\uD3EC \uBA85\uB839\uC5B4</h3>
<pre>
# \uAC1C\uBC1C
npm run dev          # \uB85C\uCEEC \uAC1C\uBC1C \uC11C\uBC84 (localhost:3000)

# Cloudflare \uBC30\uD3EC
npm run cf:build     # Cloudflare\uC6A9 \uBE4C\uB4DC
npm run cf:preview   # \uB85C\uCEEC \uBBF8\uB9AC\uBCF4\uAE30
npm run cf:deploy    # \uD504\uB85C\uB355\uC158 \uBC30\uD3EC

# \uD658\uACBD \uBCC0\uC218
npx wrangler secret put OPENAI_API_KEY
</pre>

<h2>\uB300\uC548: Vercel</h2>
<pre>
npm run build        # \uD45C\uC900 Next.js \uBE4C\uB4DC
npm run start        # \uB85C\uCEEC \uD504\uB85C\uB355\uC158 \uC11C\uBC84
# Vercel \uB300\uC2DC\uBCF4\uB4DC &rarr; Settings &rarr; Environment Variables\uC5D0\uC11C OPENAI_API_KEY \uC124\uC815
</pre>

<h2>\uD658\uACBD \uBCC0\uC218</h2>
<table>
<tr><th>\uBCC0\uC218</th><th>\uD544\uC218</th><th>\uC124\uBA85</th></tr>
<tr><td>OPENAI_API_KEY</td><td>\uC608</td><td>\uC5D0\uC774\uC804\uD2B8 \uC2E4\uD589 \uBC0F \uC6F9 \uAC80\uC0C9\uC6A9 OpenAI API \uD0A4</td></tr>
</table>

<!-- ==================== 9. \uB2E4\uAD6D\uC5B4 \uC9C0\uC6D0 ==================== -->
<h1>9. \uB2E4\uAD6D\uC5B4 \uC9C0\uC6D0</h1>

<p>My Offer Agent\uB294 \uD55C\uAD6D\uC5B4\uC640 \uC601\uC5B4\uB97C \uC9C0\uC6D0\uD558\uBA70 \uB7F0\uD0C0\uC784 \uC5B8\uC5B4 \uC804\uD658\uC774 \uAC00\uB2A5\uD569\uB2C8\uB2E4. \uC0AC\uC6A9\uC790\uC758 \uC120\uD638\uB294 \uBE0C\uB77C\uC6B0\uC800\uC5D0 \uC800\uC7A5\uB429\uB2C8\uB2E4.</p>

<table>
<tr><th>\uCF54\uB4DC</th><th>\uC5B8\uC5B4</th><th>\uCEE4\uBC84\uB9AC\uC9C0</th></tr>
<tr><td>en</td><td>English</td><td>\uC804\uCCB4 (\uAE30\uBCF8\uAC12)</td></tr>
<tr><td>ko</td><td>\uD55C\uAD6D\uC5B4</td><td>\uC804\uCCB4</td></tr>
</table>

<h2>\uAD6C\uD604 \uBC29\uC2DD</h2>
<ul>
<li><strong>\uBC29\uC2DD:</strong> <code>i18n.ts</code>\uC5D0 flat key-value \uC0AC\uC804</li>
<li><strong>\uC0C1\uD0DC:</strong> React Context (<code>i18n-context.tsx</code>) + localStorage \uC601\uC18D\uC131</li>
<li><strong>\uBC94\uC704:</strong> UI \uB808\uC774\uBE14, \uD234\uD301, \uC5D0\uC774\uC804\uD2B8 \uC0AC\uC774\uB4DC\uBC14, \uC5D0\uB7EC \uBA54\uC2DC\uC9C0, \uD50C\uB808\uC774\uC2A4\uD640\uB354</li>
<li><strong>\uC5D0\uC774\uC804\uD2B8 \uC5B8\uC5B4:</strong> \uC5B8\uC5B4 \uD30C\uB77C\uBBF8\uD130\uB97C API\uB85C \uC804\uC1A1; \uC601\uC5B4 \uBAA8\uB4DC\uC5D0\uC11C\uB294 \uC601\uC5B4 \uC751\uB2F5\uC744 \uAC15\uC81C\uD558\uB294 \uBA85\uB839\uC744 \uCD94\uAC00</li>
</ul>

<p>URL \uAE30\uBC18 \uB85C\uCF00\uC77C \uB77C\uC6B0\uD305\uC774\uB098 \uBB34\uAC70\uC6B4 i18n \uB77C\uC774\uBE0C\uB7EC\uB9AC \uC5C6\uC774 &mdash; \uC774\uC911 \uC5B8\uC5B4 \uC560\uD50C\uB9AC\uCF00\uC774\uC158\uC5D0 \uC801\uD569\uD55C \uACBD\uB7C9 \uC811\uADFC \uBC29\uC2DD\uC785\uB2C8\uB2E4.</p>

<div class="footer">
<p><strong>My Offer Agent</strong> - \uAE40\uCC2C\uC911 \uAC1C\uBC1C</p>
<p>\uC774\uBA54\uC77C: chanjoongx@gmail.com | GitHub: github.com/chanjoongx/myofferagent</p>
</div>

</body>
</html>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: "networkidle" });

  const outPath = resolve(__dirname, "MyOfferAgent-Guide-KO.pdf");
  await page.pdf({
    path: outPath,
    format: "A4",
    margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
    printBackground: true,
  });

  console.log("PDF \uC0DD\uC131 \uC644\uB8CC:", outPath);
  await browser.close();
}

main().catch(console.error);
