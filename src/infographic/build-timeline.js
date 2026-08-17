import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

export function buildTimeline({ reportsDir = "reports", outDir = reportsDir } = {}) {
  const files = readdirSync(reportsDir)
    .filter((file) => /^communication-reflection-\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .sort();

  const reports = files.map((file) => {
    const report = JSON.parse(readFileSync(join(reportsDir, file), "utf8"));
    const date = basename(file, ".json").replace("communication-reflection-", "");
    const counts = parseCoverage(report.overview.coverage);
    const total = counts.gmail + counts.chat + counts.meet;
    const score = estimateScore(report);
    return {
      date,
      reportDate: report.reportDate,
      counts,
      total,
      score,
      sentiment: inferSentiment(report),
      sentimentTone: inferSentimentTone(report),
      theme: report.overview.topics[0] ?? ""
    };
  });

  if (reports.length === 0) throw new Error(`No report JSON files found in ${reportsDir}.`);

  const missingDates = expandRange(reports[0].date, reports.at(-1).date)
    .filter((date) => !new Set(reports.map((report) => report.date)).has(date));

  const totals = {
    gmail: sum(reports, (report) => report.counts.gmail),
    chat: sum(reports, (report) => report.counts.chat),
    meet: sum(reports, (report) => report.counts.meet),
    all: sum(reports, (report) => report.total),
    days: reports.length,
    averageScore: Math.round(sum(reports, (report) => report.score) / reports.length)
  };

  const data = {
    generatedAt: new Date().toISOString(),
    scoringNote: "Communication score is an editorial index based on clarity, constructive action, follow-through, sentiment, and tone risk.",
    reports,
    missingDates,
    totals
  };

  mkdirSync(outDir, { recursive: true });
  const dataFile = join(outDir, "communication-infographic-data.json");
  const htmlFile = join(outDir, "communication-infographic.html");
  writeFileSync(dataFile, `${JSON.stringify(data, null, 2)}\n`);
  writeFileSync(htmlFile, buildHtml(data));
  return { dataFile, htmlFile, days: reports.length, missingDates };
}

function buildHtml({ reports, totals, missingDates, scoringNote }) {
  const maxTotal = Math.max(...reports.map((report) => report.total));
  const rows = reports.map((report) => `
    <tr>
      <td>${escapeHtml(report.date)}</td>
      <td>${report.total}</td>
      <td>${report.counts.gmail} / ${report.counts.chat} / ${report.counts.meet}</td>
      <td>${report.score}</td>
      <td><span class="tone" style="background:${report.sentimentTone.color}"></span>${escapeHtml(report.sentimentTone.name)}</td>
      <td>${escapeHtml(report.theme)}</td>
    </tr>`).join("");

  const sentimentCards = reports.map((report) => `
    <article style="--tone:${report.sentimentTone.color}">
      <time>${escapeHtml(report.date)}</time>
      <strong>${escapeHtml(report.sentimentTone.name)}</strong>
      <p>${escapeHtml(report.sentiment)}</p>
    </article>`).join("");

  const bars = reports.map((report) => {
    const width = Math.max(4, Math.round((report.total / maxTotal) * 100));
    return `
      <div class="bar-row">
        <span>${escapeHtml(report.date)}</span>
        <div><i style="width:${width}%"></i></div>
        <b>${report.total}</b>
      </div>`;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Communication Reflection Timeline</title>
  <style>
    body{margin:0;background:#fbfaf7;color:#1d2433;font:15px/1.5 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{max-width:1120px;margin:0 auto;padding:34px 22px 48px}
    h1{font-size:52px;line-height:1.04;margin:0 0 10px}
    h2{font-size:20px;margin:0 0 14px}
    .lede{color:#647083;font-size:18px;max-width:760px}
    .grid{display:grid;gap:20px;margin-top:24px}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:22px}
    .metric,.card{background:white;border:1px solid #d9dee8;border-radius:8px;padding:18px}
    .metric strong{display:block;font-size:30px}
    .metric span,.note{color:#647083}
    .sentiment{display:grid;grid-template-columns:repeat(${reports.length},minmax(150px,1fr));gap:10px;overflow-x:auto}
    .sentiment article{min-width:150px;border-top:8px solid var(--tone);border-radius:8px;border-left:1px solid #d9dee8;border-right:1px solid #d9dee8;border-bottom:1px solid #d9dee8;padding:12px;background:white}
    .sentiment time{display:block;color:#647083;font-size:12px;margin-bottom:6px}
    .sentiment strong{display:block;color:var(--tone);margin-bottom:4px}
    .sentiment p{margin:0;color:#647083;font-size:13px}
    .bar-row{display:grid;grid-template-columns:92px 1fr 48px;gap:10px;align-items:center;margin:8px 0}
    .bar-row div{height:18px;background:#eef1f6;border-radius:4px;overflow:hidden}
    .bar-row i{display:block;height:100%;background:#5b63d8}
    table{width:100%;border-collapse:collapse}
    th,td{text-align:left;border-bottom:1px solid #d9dee8;padding:9px 8px;vertical-align:top}
    th{color:#647083;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
    .tone{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:7px}
    @media(max-width:760px){h1{font-size:36px}.summary{grid-template-columns:repeat(2,1fr)}}
  </style>
</head>
<body>
  <main>
    <h1>Communication Reflection Timeline</h1>
    <p class="lede">Saved daily coaching reports from ${escapeHtml(reports[0].date)} to ${escapeHtml(reports.at(-1).date)}. Volume and sentiment are editorial summaries derived from structured report JSON.</p>
    <section class="summary">
      <div class="metric"><strong>${totals.all}</strong><span>Total items</span></div>
      <div class="metric"><strong>${totals.days}</strong><span>Report days</span></div>
      <div class="metric"><strong>${totals.averageScore}</strong><span>Avg score</span></div>
      <div class="metric"><strong>${missingDates.length}</strong><span>Missing dates</span></div>
    </section>
    <section class="grid">
      <div class="card"><h2>Colour-Coded Sentiment Timeline</h2><div class="sentiment">${sentimentCards}</div></div>
      <div class="card"><h2>Communication Volume</h2>${bars}<p class="note">${escapeHtml(scoringNote)}</p></div>
      <div class="card"><h2>Daily Detail</h2><table><thead><tr><th>Date</th><th>Total</th><th>Gmail / Chat / Meet</th><th>Score</th><th>Sentiment</th><th>Theme</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>
  </main>
</body>
</html>`;
}

function parseCoverage(coverage) {
  const text = coverage.join(" ");
  return {
    gmail: numberAfter(text, /Gmail sent:\s*(\d+)/),
    chat: numberAfter(text, /Chat authored messages:\s*(\d+)/),
    meet: numberAfter(text, /Meet transcript entries:\s*(\d+)/)
  };
}

function numberAfter(text, regex) {
  return Number(text.match(regex)?.[1] ?? 0);
}

function estimateScore(report) {
  const text = [...report.thingsDoneWell, ...report.thingsToImprove.paragraphs, ...report.overallSentiment].join(" ").toLowerCase();
  const positive = countTerms(text, ["strong", "clear", "practical", "useful", "constructive", "specific", "generous", "controlled"]);
  const negative = countTerms(text, ["risk", "sharp", "frustration", "overloaded", "strained", "sensitive", "uncertainty", "tense"]);
  return clamp(Math.round(76 + positive * 1.1 - negative * 1.5), 55, 92);
}

function inferSentiment(report) {
  return report.overallSentiment.join(" ").split(".")[0].slice(0, 80);
}

function inferSentimentTone(report) {
  const text = report.overallSentiment.join(" ").toLowerCase();
  if (text.includes("overloaded") || text.includes("strained")) return { name: "Strained / Overloaded", color: "#b6465a" };
  if (text.includes("tense") || text.includes("pressure") || text.includes("uncertainty")) return { name: "Pressure / Tension", color: "#df8f2d" };
  if (text.includes("inventive") || text.includes("exploratory") || text.includes("creative")) return { name: "Creative Momentum", color: "#2f8fc6" };
  if (text.includes("appreciative") || text.includes("positive")) return { name: "Appreciation", color: "#2f9c75" };
  return { name: "Steady", color: "#4c9a50" };
}

function countTerms(text, terms) {
  return terms.reduce((count, term) => count + (text.match(new RegExp(`\\b${term}\\b`, "g")) ?? []).length, 0);
}

function expandRange(start, end) {
  const dates = [];
  const current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function sum(items, fn) {
  return items.reduce((total, item) => total + fn(item), 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
