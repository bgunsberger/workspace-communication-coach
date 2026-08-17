import { readFileSync } from "node:fs";
import { readApiResponse } from "../lib/http.js";
import { reportDateLabel } from "../lib/dates.js";
import { extractJsonObject, validateReportShape } from "../lib/json.js";

export async function generateReport({ rawDay, promptFile, provider = "mock", credential = "", credentialType = "", model = "" }) {
  const normalizedProvider = provider.toLowerCase();
  if (normalizedProvider === "mock") {
    const report = generateMockReport(rawDay);
    validateReportShape(report);
    return report;
  }

  const prompt = readFileSync(promptFile, "utf8");
  const input = `${prompt}\n\nRaw daily communication data:\n${JSON.stringify(rawDay, null, 2)}`;
  let report;

  if (normalizedProvider === "openai") {
    report = await generateOpenAiReport({ input, credential, model });
  } else if (normalizedProvider === "anthropic") {
    report = await generateAnthropicReport({ input, credential, credentialType, model });
  } else {
    throw new Error(`Unsupported LLM provider: ${provider}. Use mock, openai, or anthropic.`);
  }

  validateReportShape(report);
  return report;
}

async function generateOpenAiReport({ input, credential, model }) {
  if (!credential) {
    throw new Error("Missing LLM_CREDENTIAL for OpenAI. Set LLM_PROVIDER=openai and LLM_CREDENTIAL in .env.");
  }
  if (!model) {
    throw new Error("Missing LLM_MODEL for OpenAI.");
  }
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${credential}`
    },
    body: JSON.stringify({
      model,
      input,
      temperature: 0.2,
      max_output_tokens: 6000
    })
  });
  const data = await readApiResponse(response);
  return extractJsonObject(data.output_text ?? collectOpenAiText(data));
}

async function generateAnthropicReport({ input, credential, credentialType, model }) {
  if (!credential) {
    throw new Error("Missing LLM_CREDENTIAL for Anthropic. Set LLM_PROVIDER=anthropic and LLM_CREDENTIAL in .env.");
  }
  if (!model) {
    throw new Error("Missing LLM_MODEL for Anthropic.");
  }
  const authHeaders = credentialType === "bearer" ? { authorization: `Bearer ${credential}` } : { "x-api-key": credential };
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      ...authHeaders
    },
    body: JSON.stringify({
      model,
      max_tokens: 6000,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: input
        }
      ]
    })
  });
  const data = await readApiResponse(response);
  const text = (data.content ?? []).map((part) => part.text ?? "").join("\n");
  return extractJsonObject(text);
}

function collectOpenAiText(data) {
  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((part) => part.text ?? "")
    .join("\n");
}

function generateMockReport(rawDay) {
  const counts = rawDay.counts ?? {};
  const snippets = collectSnippets(rawDay);
  const topics = snippets.length
    ? snippets.slice(0, 5).map((text) => summarizeSnippet(text))
    : ["No authored communication was present in the provided raw data."];
  const hasMessages = snippets.length > 0;

  return {
    title: `Communication Reflection - ${rawDay.date}`,
    reportDate: reportDateLabel(rawDay.date),
    timezone: "Australia/Sydney",
    overview: {
      coverage: [
        `Gmail sent: ${counts.gmailSent ?? 0}`,
        `Chat authored messages: ${counts.chatMessages ?? 0}`,
        `Meet transcript entries: ${counts.meetTranscriptEntries ?? 0} across ${counts.meetTranscripts ?? 0} meeting transcripts`
      ],
      topics
    },
    thingsDoneWell: hasMessages
      ? [
          "You kept the day grounded in concrete operational details, which makes the communication easier to act on.",
          "You used direct phrasing around decisions, next steps, and review points.",
          "You surfaced uncertainty where a decision or owner was still needed."
        ]
      : ["There was no authored communication in the provided data to assess."],
    thingsToImprove: {
      paragraphs: hasMessages
        ? [
            "The main improvement area is making ownership and decision state explicit whenever a topic moves from discussion into action.",
            "Several messages would become easier to follow if they included the desired response, deadline, or approval path in the same note."
          ]
        : ["No improvement pattern can be inferred without authored messages."],
      examples: hasMessages
        ? [
            "Decision wrapper: I recommend this path, and I need approval from the owner before I apply it more broadly.",
            "Follow-up wrapper: the next step is yours, and a response by end of day would keep this moving.",
            "Scope wrapper: this solves the current case; we should decide separately whether it becomes the default workflow."
          ]
        : ["No rewrite examples are available without source communication."]
    },
    followUps: hasMessages
      ? [
          "Identify any messages that imply a pending decision and assign a clear owner.",
          "Confirm which topics need a reply, approval, or documented next step.",
          "Turn any repeated workflow discussion into a short reusable note or checklist.",
          "Check whether meeting follow-ups were also captured in email or chat.",
          "Review whether any high-context phrasing needs a clearer summary for people outside the thread.",
          "Close out any open loops created by direct requests."
        ]
      : ["No follow-up items were found in the provided data."],
    personalityLens: {
      paragraphs: [
        "High conscientiousness may show up as a preference for closing loops, clarifying process, and turning loose discussion into tracked work.",
        "High assertiveness and energy can help move decisions forward quickly, especially when the team needs a clear recommendation.",
        "High open-mindedness may explain the tendency to test workflows and generalise useful experiments into repeatable systems."
      ],
      examples: [
        "Conscientiousness: naming next steps and keeping delivery details visible.",
        "Assertiveness: proposing a path instead of leaving a decision vague.",
        "Open-mindedness: treating an experiment as a possible reusable workflow.",
        "Agreeableness: framing critique as a process issue rather than a personal one."
      ]
    },
    overallSentiment: hasMessages
      ? [
          "The day reads as practical, engaged, and delivery-focused.",
          "The coaching watch-out is to pair fast judgement with explicit ownership so collaborators know exactly what happens next."
        ]
      : [
          "The provided day has no authored communication to analyse.",
          "The coaching watch-out is data coverage: confirm that the collectors ran against the intended account and date."
        ]
  };
}

function collectSnippets(rawDay) {
  return [
    ...(rawDay.gmail ?? []).map((item) => item.subject || item.text),
    ...(rawDay.chat ?? []).map((item) => item.text),
    ...(rawDay.meet?.entries ?? []).map((item) => item.text)
  ].filter(Boolean);
}

function summarizeSnippet(text) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const sentence = trimmed.split(/(?<=[.!?])\s+/)[0] ?? trimmed;
  return sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence;
}
