import { readFileSync, writeFileSync } from "node:fs";

export function loadJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function saveJson(file, data) {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

export function extractJsonObject(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM response did not contain a JSON object.");
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

export function validateReportShape(report) {
  const required = ["title", "reportDate", "timezone", "overview", "thingsDoneWell", "thingsToImprove", "followUps", "personalityLens", "overallSentiment"];
  for (const key of required) {
    if (!(key in report)) throw new Error(`Report missing required key: ${key}`);
  }
  if (!Array.isArray(report.overview?.coverage)) throw new Error("Report overview.coverage must be an array.");
  if (!Array.isArray(report.overview?.topics)) throw new Error("Report overview.topics must be an array.");
  if (!Array.isArray(report.thingsDoneWell)) throw new Error("Report thingsDoneWell must be an array.");
  if (!Array.isArray(report.thingsToImprove?.paragraphs)) throw new Error("Report thingsToImprove.paragraphs must be an array.");
  if (!Array.isArray(report.thingsToImprove?.examples)) throw new Error("Report thingsToImprove.examples must be an array.");
  if (!Array.isArray(report.followUps)) throw new Error("Report followUps must be an array.");
  if (!Array.isArray(report.personalityLens?.paragraphs)) throw new Error("Report personalityLens.paragraphs must be an array.");
  if (!Array.isArray(report.personalityLens?.examples)) throw new Error("Report personalityLens.examples must be an array.");
  if (!Array.isArray(report.overallSentiment)) throw new Error("Report overallSentiment must be an array.");
}
