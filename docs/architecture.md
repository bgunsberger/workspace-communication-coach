# Architecture

Workspace Communication Coach is a small CLI pipeline.

## Data Flow

```text
Google OAuth token
  -> collect authored daily communication
  -> save raw daily JSON
  -> generate structured reflection JSON with a pluggable LLM provider
  -> render formatted Google Doc
  -> build optional longitudinal infographic
```

## Design Choices

- Collect authored messages only.
- Store report content as JSON.
- Keep provider-specific LLM calls behind a small adapter.
- Use deterministic Google Docs rendering.
- Treat the prompt as a versioned project artifact.
- Use synthetic examples for public sharing.

## Provider Auth

Google Workspace access uses an interactive OAuth browser flow and stores the resulting token locally.

The report-generation step uses a provider adapter. For local tests, `LLM_PROVIDER=mock` avoids any model credential. For model-backed generation, set `LLM_PROVIDER=openai` or `LLM_PROVIDER=anthropic` with `LLM_CREDENTIAL` and `LLM_MODEL`.

A hosted product would normally move the model-provider credential to a server-side secret store. Users would sign in to the product with a web flow, grant Google Workspace access with OAuth, and the backend would call the selected model provider without exposing provider keys to the client.

## Why JSON Instead Of Markdown

Markdown is ambiguous once it reaches Google Docs. The renderer treats JSON as semantic source data and applies formatting through the Google Docs API:

- `TITLE` for the report title
- `HEADING_1` for section headings
- `NORMAL_TEXT` for paragraphs
- `createParagraphBullets` for bullet lists

This keeps the LLM output machine-parseable and the document formatting deterministic.
