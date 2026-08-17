import { googleGet } from "../lib/http.js";

const MAX_CHAT_SPACES = 80;
const MAX_CHAT_PAGES_PER_SPACE = 3;

export async function collectChat(accessToken, range, selfUserName) {
  const spaces = await listChatSpaces(accessToken);
  const items = [];

  for (const space of spaces) {
    let pageToken = "";
    let pages = 0;

    while (pages < MAX_CHAT_PAGES_PER_SPACE) {
      pages += 1;
      const url = new URL(`https://chat.googleapis.com/v1/${space.name}/messages`);
      url.searchParams.set("pageSize", "100");
      url.searchParams.set("orderBy", "createTime DESC");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      let data;
      try {
        data = await googleGet(accessToken, url);
      } catch {
        break;
      }

      const messages = data.messages ?? [];
      for (const message of messages) {
        const timestamp = new Date(message.createTime);
        if (
          timestamp >= range.start &&
          timestamp < range.end &&
          message.sender?.name === selfUserName &&
          message.text?.trim()
        ) {
          items.push({
            spaceName: space.name,
            spaceDisplayName: space.displayName ?? "",
            spaceType: space.spaceType ?? "",
            threadName: message.thread?.name ?? "",
            timestamp: message.createTime,
            text: clip(message.text.trim(), 5000)
          });
        }
      }

      pageToken = data.nextPageToken ?? "";
      const oldest = messages.at(-1)?.createTime ? new Date(messages.at(-1).createTime) : null;
      if (!pageToken || (oldest && oldest < range.start)) break;
    }
  }

  return items.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

async function listChatSpaces(accessToken) {
  const spaces = [];
  let pageToken = "";

  while (spaces.length < MAX_CHAT_SPACES) {
    const url = new URL("https://chat.googleapis.com/v1/spaces");
    url.searchParams.set("pageSize", String(Math.min(100, MAX_CHAT_SPACES - spaces.length)));
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const data = await googleGet(accessToken, url);
    spaces.push(...(data.spaces ?? []));
    pageToken = data.nextPageToken ?? "";
    if (!pageToken) break;
  }

  return spaces;
}

function clip(text, max) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}
