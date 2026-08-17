import { existsSync, readFileSync } from "node:fs";

export function loadEnv(file = ".env") {
  if (!existsSync(file)) return;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

export function getConfig() {
  loadEnv();
  return {
    credentialsFile: process.env.GOOGLE_OAUTH_CLIENT ?? "credentials/oauth-client.json",
    tokenFile: process.env.GOOGLE_TOKEN_FILE ?? ".tokens/google-workspace.json",
    reportsDir: process.env.REPORTS_DIR ?? "reports",
    timezoneOffset: process.env.TIMEZONE_OFFSET ?? "+10:00",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5"
  };
}
