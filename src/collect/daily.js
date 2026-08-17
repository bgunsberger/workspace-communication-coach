import { getAccessToken, loadToken, parseJwt } from "../auth/google-oauth.js";
import { collectGmail } from "./gmail.js";
import { collectChat } from "./chat.js";
import { collectMeet } from "./meet.js";
import { localDayRange } from "../lib/dates.js";

export async function collectDaily({ date, offset, credentialsFile, tokenFile }) {
  const range = localDayRange(date, offset);
  const token = loadToken(tokenFile);
  if (!token?.id_token) {
    throw new Error("Missing id_token. Run auth again so user identity can be resolved.");
  }
  const identity = parseJwt(token.id_token);
  const selfUserName = `users/${identity.sub}`;
  const accessToken = await getAccessToken({ credentialsFile, tokenFile });

  const [gmail, chat, meet] = await Promise.all([
    collectGmail(accessToken, range),
    collectChat(accessToken, range, selfUserName),
    collectMeet(accessToken, range, selfUserName)
  ]);

  return {
    date,
    timezoneOffset: offset,
    utcRange: {
      start: range.start.toISOString(),
      end: range.end.toISOString()
    },
    identity: {
      email: identity.email ?? "",
      userName: selfUserName
    },
    counts: {
      gmailSent: gmail.length,
      chatMessages: chat.length,
      meetTranscriptEntries: meet.entries.length,
      meetTranscripts: meet.transcripts.length
    },
    gmail,
    chat,
    meet
  };
}
