import { googleGet } from "../lib/http.js";
import { ymdForGmail } from "../lib/dates.js";

export async function collectGmail(accessToken, range) {
  const ids = await listGmailSentIds(accessToken, range);
  const items = [];

  for (const id of ids) {
    const message = await googleGet(accessToken, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`);
    const timestamp = new Date(Number(message.internalDate));
    if (timestamp < range.start || timestamp >= range.end) continue;

    items.push({
      id: message.id,
      threadId: message.threadId,
      timestamp: timestamp.toISOString(),
      to: header(message, "to"),
      cc: header(message, "cc"),
      subject: header(message, "subject"),
      text: clip(topAuthoredText(extractPlainText(message.payload)), 5000)
    });
  }

  return items.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

async function listGmailSentIds(accessToken, range) {
  const queryStart = ymdForGmail(new Date(range.start.getTime() - 24 * 60 * 60 * 1000));
  const queryEnd = ymdForGmail(new Date(range.end.getTime() + 24 * 60 * 60 * 1000));
  const ids = [];
  let pageToken = "";

  while (true) {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    url.searchParams.set("q", `in:sent after:${queryStart} before:${queryEnd}`);
    url.searchParams.set("maxResults", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const data = await googleGet(accessToken, url);
    ids.push(...(data.messages ?? []).map((message) => message.id));
    pageToken = data.nextPageToken ?? "";
    if (!pageToken) break;
  }

  return ids;
}

function header(message, name) {
  return message.payload?.headers?.find((item) => item.name.toLowerCase() === name)?.value ?? "";
}

function extractPlainText(part) {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  }
  return (part.parts ?? []).map(extractPlainText).join("\n");
}

function topAuthoredText(text) {
  return text
    .split(/\nOn .+ wrote:\n/s)[0]
    .split(/\n-{2,}Original Message-{2,}/i)[0]
    .trim();
}

function clip(text, max) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}
