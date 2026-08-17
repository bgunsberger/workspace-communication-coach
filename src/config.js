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
  const llmProvider = firstNonEmpty(
    process.env.LLM_PROVIDER,
    process.env.OPENAI_API_KEY ? "openai" : "",
    process.env.ANTHROPIC_API_KEY ? "anthropic" : "",
    "mock"
  ).toLowerCase();

  return {
    credentialsFile: process.env.GOOGLE_OAUTH_CLIENT ?? "credentials/oauth-client.json",
    tokenFile: process.env.GOOGLE_TOKEN_FILE ?? ".tokens/google-workspace.json",
    reportsDir: process.env.REPORTS_DIR ?? "reports",
    timezoneOffset: process.env.TIMEZONE_OFFSET ?? "+10:00",
    llmProvider,
    llmCredential: firstNonEmpty(process.env.LLM_CREDENTIAL, process.env.LLM_API_KEY, process.env.OPENAI_API_KEY, process.env.ANTHROPIC_API_KEY),
    llmCredentialType: firstNonEmpty(process.env.LLM_CREDENTIAL_TYPE, defaultCredentialType(llmProvider)),
    llmModel: firstNonEmpty(process.env.LLM_MODEL, process.env.OPENAI_MODEL, process.env.ANTHROPIC_MODEL, defaultModel(llmProvider))
  };
}

function defaultCredentialType(provider) {
  if (provider === "anthropic") return "api_key";
  if (provider === "openai") return "bearer";
  return "";
}

function defaultModel(provider) {
  if (provider === "openai") return "gpt-5.6";
  if (provider === "anthropic") return "claude-sonnet-4-5";
  return "";
}

function firstNonEmpty(...values) {
  return values.find((value) => value && value.trim()) ?? "";
}
