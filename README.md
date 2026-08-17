# Workspace Communication Coach

Private end-of-day communication coaching from your own Google Workspace data.

This project explores a personal reflection loop: collect only the messages you authored during a workday, ask an LLM for structured coaching feedback, render the result into a formatted Google Doc, and track patterns over time.

It is designed for self-reflection. It should not be used for employee surveillance, performance management, or analysis of other people without consent.

## What It Does

- Collects sent Gmail messages for a date.
- Collects Google Chat messages authored by the authenticated user.
- Collects Google Meet transcript entries spoken by the authenticated user.
- Generates a structured JSON coaching report with a prompt template.
- Validates and stores the report as JSON.
- Renders a formatted Google Doc using the Google Docs API.
- Builds a timeline/infographic from saved reports.

## Architecture

```text
Google OAuth
  -> Gmail / Chat / Meet collectors
  -> raw daily JSON
  -> LLM report prompt
  -> reflection report JSON
  -> deterministic Google Docs renderer
  -> Google Doc URL
  -> optional timeline infographic
```

The LLM writes structured JSON. The renderer applies Google Docs formatting with `documents.batchUpdate`. The model never writes Markdown into the document.

## Setup

Clone the repo and check the synthetic example first:

```sh
git clone https://github.com/bgunsberger/workspace-communication-coach.git
cd workspace-communication-coach
npm run example:infographic
```

The example command uses synthetic report data and writes generated files to `examples/generated/`.

1. Create a Google Cloud project.
2. Configure an OAuth consent screen.
3. Create an OAuth client ID for a Desktop app.
4. Enable these APIs:
   - Gmail API
   - Google Chat API
   - Google Meet API
   - Google Docs API
5. Save the OAuth JSON as:

```sh
mkdir -p credentials
cp ~/Downloads/client_secret_*.json credentials/oauth-client.json
```

6. Copy `.env.example` to `.env` and add your Anthropic API key if you want automatic report generation:

```sh
cp .env.example .env
```

## Run

Authorize Google Workspace access:

```sh
npm run auth
```

Collect one day of authored communication:

```sh
npm run collect -- --date 2026-06-05 --offset +10:00 --out reports/raw-2026-06-05.json
```

Generate a report JSON:

```sh
npm run generate -- --input reports/raw-2026-06-05.json --out reports/communication-reflection-2026-06-05.json
```

This step requires `ANTHROPIC_API_KEY` in `.env`.

Render the formatted Google Doc:

```sh
npm run render -- --report-file reports/communication-reflection-2026-06-05.json
```

Run the full pipeline:

```sh
npm run run -- --date 2026-06-05 --offset +10:00
```

Build an infographic from saved report JSON files:

```sh
npm run infographic
```

## Google Chat Notes

Google Chat uses `spaces` for all conversation containers, including direct messages, group chats, and named spaces. The collector lists visible spaces, lists recent messages in each one, and keeps only messages where:

```js
message.sender?.name === `users/${identity.sub}`
```

This means the tool collects the authenticated user's authored messages, not other people's messages.

## Privacy

Keep these files private:

- `.tokens/`
- `credentials/`
- `reports/`
- raw Google Workspace exports
- generated reports based on real workplace data

Public examples in this repo are synthetic.

## Thought Leadership Framing

Most workplace AI tooling focuses on summarising meetings or drafting replies. This project explores a different loop: a self-owned communication mirror for noticing tone, overload, follow-ups, decision clarity, and patterns over time.

The useful boundary is ownership: the authenticated user analyses their own authored communication.
