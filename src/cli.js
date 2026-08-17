#!/usr/bin/env node

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { authorize } from "./auth/google-oauth.js";
import { collectDaily } from "./collect/daily.js";
import { generateReport } from "./llm/generate-report.js";
import { renderGoogleDoc } from "./render/google-docs.js";
import { buildTimeline } from "./infographic/build-timeline.js";
import { getConfig } from "./config.js";
import { loadJson, saveJson, validateReportShape } from "./lib/json.js";

main().catch((error) => {
  console.error(`Fatal: ${error.message}`);
  process.exit(1);
});

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const options = parseArgs(args);
  const config = getConfig();

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "auth") {
    const token = await authorize({
      credentialsFile: options.credentials ?? config.credentialsFile,
      tokenFile: options.tokenFile ?? config.tokenFile
    });
    console.log(JSON.stringify({ ok: true, scopes: token.scope }, null, 2));
    return;
  }

  if (command === "collect") {
    const date = required(options.date, "--date");
    const out = options.out ?? join(config.reportsDir, `raw-${date}.json`);
    mkdirSync(config.reportsDir, { recursive: true });
    const rawDay = await collectDaily({
      date,
      offset: options.offset ?? config.timezoneOffset,
      credentialsFile: options.credentials ?? config.credentialsFile,
      tokenFile: options.tokenFile ?? config.tokenFile
    });
    saveJson(out, rawDay);
    console.log(JSON.stringify({ out, counts: rawDay.counts }, null, 2));
    return;
  }

  if (command === "generate") {
    const input = required(options.input, "--input");
    const rawDay = loadJson(input);
    const out = options.out ?? join(config.reportsDir, `communication-reflection-${rawDay.date}.json`);
    mkdirSync(config.reportsDir, { recursive: true });
    const report = await generateReport({
      rawDay,
      promptFile: options.prompt ?? "prompts/daily-reflection-writer.md",
      anthropicApiKey: options.anthropicApiKey ?? config.anthropicApiKey,
      anthropicModel: options.model ?? config.anthropicModel
    });
    saveJson(out, report);
    console.log(JSON.stringify({ out, title: report.title }, null, 2));
    return;
  }

  if (command === "render") {
    const reportFile = required(options.reportFile, "--report-file");
    const report = loadJson(reportFile);
    validateReportShape(report);
    const result = await renderGoogleDoc({
      report,
      documentId: options.documentId,
      title: options.title,
      credentialsFile: options.credentials ?? config.credentialsFile,
      tokenFile: options.tokenFile ?? config.tokenFile
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "run") {
    const date = required(options.date, "--date");
    mkdirSync(config.reportsDir, { recursive: true });
    const rawFile = options.rawOut ?? join(config.reportsDir, `raw-${date}.json`);
    const reportFile = options.reportOut ?? join(config.reportsDir, `communication-reflection-${date}.json`);
    const rawDay = await collectDaily({
      date,
      offset: options.offset ?? config.timezoneOffset,
      credentialsFile: options.credentials ?? config.credentialsFile,
      tokenFile: options.tokenFile ?? config.tokenFile
    });
    saveJson(rawFile, rawDay);
    const report = await generateReport({
      rawDay,
      promptFile: options.prompt ?? "prompts/daily-reflection-writer.md",
      anthropicApiKey: options.anthropicApiKey ?? config.anthropicApiKey,
      anthropicModel: options.model ?? config.anthropicModel
    });
    saveJson(reportFile, report);
    const doc = await renderGoogleDoc({
      report,
      credentialsFile: options.credentials ?? config.credentialsFile,
      tokenFile: options.tokenFile ?? config.tokenFile
    });
    console.log(JSON.stringify({ rawFile, reportFile, doc, counts: rawDay.counts }, null, 2));
    return;
  }

  if (command === "infographic") {
    const result = buildTimeline({
      reportsDir: options.reportsDir ?? config.reportsDir,
      outDir: options.outDir ?? options.reportsDir ?? config.reportsDir
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}

function required(value, name) {
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function printHelp() {
  console.log(`Workspace Communication Coach

Commands:
  auth
  collect --date YYYY-MM-DD [--out reports/raw-YYYY-MM-DD.json]
  generate --input reports/raw-YYYY-MM-DD.json [--out reports/communication-reflection-YYYY-MM-DD.json]
  render --report-file reports/communication-reflection-YYYY-MM-DD.json [--document-id DOC_ID]
  run --date YYYY-MM-DD
  infographic [--reports-dir reports] [--out-dir reports]
`);
}
