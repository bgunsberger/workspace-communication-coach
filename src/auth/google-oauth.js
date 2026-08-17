import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawn } from "node:child_process";
import { readApiResponse } from "../lib/http.js";

const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/chat.spaces.readonly",
  "https://www.googleapis.com/auth/chat.messages.readonly",
  "https://www.googleapis.com/auth/meetings.space.readonly",
  "https://www.googleapis.com/auth/documents"
];

export function loadCredentials(credentialsFile) {
  if (!existsSync(credentialsFile)) {
    throw new Error(`Missing Google OAuth client file: ${credentialsFile}`);
  }
  const json = JSON.parse(readFileSync(credentialsFile, "utf8"));
  return json.installed ?? json.web ?? json;
}

export function loadToken(tokenFile) {
  if (!existsSync(tokenFile)) return null;
  return JSON.parse(readFileSync(tokenFile, "utf8"));
}

export function saveToken(tokenFile, token) {
  mkdirSync(dirname(tokenFile), { recursive: true });
  writeFileSync(tokenFile, `${JSON.stringify(token, null, 2)}\n`);
}

export async function authorize({ credentialsFile, tokenFile }) {
  const credentials = loadCredentials(credentialsFile);
  const verifier = base64Url(randomBytes(64));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  const state = base64Url(randomBytes(24));

  const server = createServer();
  const codePromise = new Promise((resolve, reject) => {
    server.on("request", (req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname !== "/oauth2callback") {
        res.writeHead(404).end("Not found");
        return;
      }
      if (url.searchParams.get("state") !== state) {
        res.writeHead(400).end("Invalid state");
        reject(new Error("Invalid OAuth state."));
        return;
      }
      res.writeHead(200, { "content-type": "text/plain" }).end("Authorization complete. You can close this tab.");
      resolve(url.searchParams.get("code"));
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

  const authUrl = new URL(OAUTH_AUTH_URL);
  authUrl.searchParams.set("client_id", credentials.client_id);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  console.log(`Open this URL to authorize:\n${authUrl.href}\n`);
  openUrl(authUrl.href);

  const code = await codePromise;
  server.close();

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret ?? "",
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });
  const token = await readApiResponse(response);
  saveToken(tokenFile, token);
  return token;
}

export async function getAccessToken({ credentialsFile, tokenFile }) {
  const token = loadToken(tokenFile);
  if (!token?.refresh_token) {
    throw new Error("Missing refresh token. Run `npm run auth` first.");
  }
  const credentials = loadCredentials(credentialsFile);
  return refreshAccessToken(credentials, token.refresh_token);
}

export async function refreshAccessToken(credentials, refreshToken) {
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  const data = await readApiResponse(response);
  return data.access_token;
}

export function parseJwt(jwt) {
  const payload = jwt.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function openUrl(url) {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.unref();
}

function base64Url(buffer) {
  return buffer.toString("base64url");
}
