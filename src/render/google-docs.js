import { getAccessToken } from "../auth/google-oauth.js";
import { readApiResponse } from "../lib/http.js";

export async function renderGoogleDoc({ report, documentId, title, credentialsFile, tokenFile }) {
  const accessToken = await getAccessToken({ credentialsFile, tokenFile });
  const createdDocument = documentId ? null : await createDocument(accessToken, title ?? report.title);
  const targetDocumentId = documentId ?? createdDocument.documentId;
  const document = await getDocument(accessToken, targetDocumentId);
  const endIndex = document.body.content.at(-1)?.endIndex ?? 1;
  const requests = buildRequests(report, endIndex);
  await batchUpdate(accessToken, targetDocumentId, requests);
  return {
    documentId: targetDocumentId,
    url: `https://docs.google.com/document/d/${targetDocumentId}/edit`,
    requests: requests.length
  };
}

export function buildRequests(report, endIndex) {
  const segments = buildSegments(report);
  const text = segments.map((segment) => segment.text).join("");
  const requests = [];

  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: { startIndex: 1, endIndex: endIndex - 1 }
      }
    });
  }

  requests.push({ insertText: { location: { index: 1 }, text } });

  let index = 1;
  for (const segment of segments) {
    const start = index;
    const end = index + segment.text.length;

    if (segment.paragraphStyle) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: segment.paragraphStyle,
          fields: Object.keys(segment.paragraphStyle).join(",")
        }
      });
    }

    if (segment.textStyle) {
      requests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: Math.max(start, end - 1) },
          textStyle: segment.textStyle,
          fields: Object.keys(segment.textStyle).join(",")
        }
      });
    }

    if (segment.bullet) {
      requests.push({
        createParagraphBullets: {
          range: { startIndex: start, endIndex: end },
          bulletPreset: "BULLET_DISC_CIRCLE_SQUARE"
        }
      });
    }

    index = end;
  }

  return requests;
}

export function buildSegments(report) {
  const segments = [];

  addTitle(segments, report.title);
  addSubtitle(segments, `Report date: ${report.reportDate}`);
  addSubtitle(segments, `Timezone: ${report.timezone}`);
  addBlank(segments);

  addHeading(segments, "Overview");
  addParagraph(segments, "Coverage found:");
  for (const item of report.overview.coverage) addBullet(segments, item);
  addParagraph(segments, "Main topics:");
  for (const item of report.overview.topics) addBullet(segments, item);
  addBlank(segments);

  addHeading(segments, "Things Done Well");
  for (const paragraph of report.thingsDoneWell) addParagraph(segments, paragraph);
  addBlank(segments);

  addHeading(segments, "Things To Improve");
  for (const paragraph of report.thingsToImprove.paragraphs) addParagraph(segments, paragraph);
  for (const item of report.thingsToImprove.examples) addBullet(segments, item);
  addBlank(segments);

  addHeading(segments, "Things To Follow Up On");
  for (const item of report.followUps) addBullet(segments, item);
  addBlank(segments);

  addHeading(segments, "Personality Lens");
  for (const paragraph of report.personalityLens.paragraphs) addParagraph(segments, paragraph);
  for (const item of report.personalityLens.examples) addBullet(segments, item);
  addBlank(segments);

  addHeading(segments, "Overall Sentiment");
  for (const paragraph of report.overallSentiment) addParagraph(segments, paragraph);

  return segments;
}

async function getDocument(accessToken, documentId) {
  const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" }
  });
  return readApiResponse(response);
}

async function createDocument(accessToken, title) {
  const response = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({ title })
  });
  return readApiResponse(response);
}

async function batchUpdate(accessToken, documentId, requests) {
  const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({ requests })
  });
  return readApiResponse(response);
}

function addTitle(segments, text) {
  segments.push({
    text: `${text}\n`,
    paragraphStyle: { namedStyleType: "TITLE" },
    textStyle: { bold: true }
  });
}

function addSubtitle(segments, text) {
  segments.push({
    text: `${text}\n`,
    paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
    textStyle: {
      foregroundColor: { color: { rgbColor: { red: 0.35, green: 0.35, blue: 0.35 } } }
    }
  });
}

function addHeading(segments, text) {
  segments.push({
    text: `${text}\n`,
    paragraphStyle: {
      namedStyleType: "HEADING_1",
      spaceAbove: { magnitude: 16, unit: "PT" },
      spaceBelow: { magnitude: 6, unit: "PT" }
    },
    textStyle: { bold: true }
  });
}

function addParagraph(segments, text) {
  segments.push({
    text: `${text}\n`,
    paragraphStyle: {
      namedStyleType: "NORMAL_TEXT",
      spaceBelow: { magnitude: 6, unit: "PT" }
    }
  });
}

function addBullet(segments, text) {
  segments.push({
    text: `${text}\n`,
    paragraphStyle: {
      namedStyleType: "NORMAL_TEXT",
      indentStart: { magnitude: 18, unit: "PT" },
      indentFirstLine: { magnitude: 0, unit: "PT" },
      spaceBelow: { magnitude: 3, unit: "PT" }
    },
    bullet: true
  });
}

function addBlank(segments) {
  segments.push({ text: "\n" });
}
