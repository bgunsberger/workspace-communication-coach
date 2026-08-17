import { readFileSync } from "node:fs";
import { readApiResponse } from "../lib/http.js";
import { extractJsonObject, validateReportShape } from "../lib/json.js";

export async function generateReport({ rawDay, promptFile, anthropicApiKey, anthropicModel }) {
  if (!anthropicApiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY. Set it in .env or pass generated JSON manually.");
  }
  const prompt = readFileSync(promptFile, "utf8");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: 6000,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nRaw daily communication data:\n${JSON.stringify(rawDay, null, 2)}`
        }
      ]
    })
  });
  const data = await readApiResponse(response);
  const text = (data.content ?? []).map((part) => part.text ?? "").join("\n");
  const report = extractJsonObject(text);
  validateReportShape(report);
  return report;
}
