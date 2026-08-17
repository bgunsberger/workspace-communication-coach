import { googleGet } from "../lib/http.js";

const MAX_CONFERENCE_RECORDS = 40;

export async function collectMeet(accessToken, range, selfUserName) {
  const conferenceRecords = await listConferenceRecords(accessToken);
  const transcripts = [];
  const entries = [];

  for (const conferenceRecord of conferenceRecords) {
    const recordStart = conferenceRecord.startTime ? new Date(conferenceRecord.startTime) : null;
    const recordEnd = conferenceRecord.endTime ? new Date(conferenceRecord.endTime) : null;
    if (recordEnd && recordEnd < range.start) break;
    if (recordStart && recordStart >= range.end) continue;

    const recordTranscripts = await listTranscripts(accessToken, conferenceRecord.name);
    if (recordTranscripts.length === 0) continue;

    const participants = await listParticipants(accessToken, conferenceRecord.name);
    const myParticipantNames = participants
      .filter((participant) => signedInUserName(participant) === selfUserName)
      .map((participant) => participant.name);

    for (const transcript of recordTranscripts) {
      const transcriptEntries = await listTranscriptEntries(accessToken, transcript.name);
      const myEntries = transcriptEntries.filter((entry) => {
        const timestamp = new Date(entry.startTime);
        return timestamp >= range.start && timestamp < range.end && myParticipantNames.includes(entry.participant) && entry.text?.trim();
      });

      if (myEntries.length > 0) {
        transcripts.push({
          conferenceRecord: conferenceRecord.name,
          conferenceStart: conferenceRecord.startTime ?? "",
          conferenceEnd: conferenceRecord.endTime ?? "",
          transcriptName: transcript.name,
          transcriptStart: transcript.startTime ?? "",
          transcriptEnd: transcript.endTime ?? "",
          document: transcript.docsDestination?.document ?? "",
          myEntryCount: myEntries.length
        });

        entries.push(...myEntries.map((entry) => ({
          conferenceRecord: conferenceRecord.name,
          transcriptName: transcript.name,
          timestamp: entry.startTime ?? "",
          endTime: entry.endTime ?? "",
          text: clip(entry.text.trim(), 5000)
        })));
      }
    }
  }

  return {
    transcripts,
    entries: entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  };
}

async function listConferenceRecords(accessToken) {
  const records = [];
  let pageToken = "";

  while (records.length < MAX_CONFERENCE_RECORDS) {
    const url = new URL("https://meet.googleapis.com/v2/conferenceRecords");
    url.searchParams.set("pageSize", String(Math.min(100, MAX_CONFERENCE_RECORDS - records.length)));
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const data = await googleGet(accessToken, url);
    records.push(...(data.conferenceRecords ?? []));
    pageToken = data.nextPageToken ?? "";
    if (!pageToken) break;
  }

  return records.sort((a, b) => (b.startTime ?? "").localeCompare(a.startTime ?? ""));
}

async function listTranscripts(accessToken, conferenceRecordName) {
  const url = new URL(`https://meet.googleapis.com/v2/${conferenceRecordName}/transcripts`);
  url.searchParams.set("pageSize", "100");
  const data = await googleGet(accessToken, url);
  return data.transcripts ?? [];
}

async function listTranscriptEntries(accessToken, transcriptName) {
  const entries = [];
  let pageToken = "";

  while (true) {
    const url = new URL(`https://meet.googleapis.com/v2/${transcriptName}/entries`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await googleGet(accessToken, url);
    entries.push(...(data.transcriptEntries ?? []));
    pageToken = data.nextPageToken ?? "";
    if (!pageToken) break;
  }

  return entries;
}

async function listParticipants(accessToken, conferenceRecordName) {
  const participants = [];
  let pageToken = "";

  while (true) {
    const url = new URL(`https://meet.googleapis.com/v2/${conferenceRecordName}/participants`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await googleGet(accessToken, url);
    participants.push(...(data.participants ?? []));
    pageToken = data.nextPageToken ?? "";
    if (!pageToken) break;
  }

  return participants;
}

function signedInUserName(participant) {
  return participant.signedinUser?.user ?? "";
}

function clip(text, max) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}
