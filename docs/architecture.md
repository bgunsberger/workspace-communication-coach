# Architecture

Workspace Communication Coach is a small CLI pipeline.

## Data Flow

```text
Google OAuth token
  -> collect authored daily communication
  -> save raw daily JSON
  -> generate structured reflection JSON
  -> render formatted Google Doc
  -> build optional longitudinal infographic
```

## Design Choices

- Collect authored messages only.
- Store report content as JSON.
- Use deterministic Google Docs rendering.
- Treat the prompt as a versioned project artifact.
- Use synthetic examples for public sharing.

## Why JSON Instead Of Markdown

Markdown is ambiguous once it reaches Google Docs. The renderer treats JSON as semantic source data and applies formatting through the Google Docs API:

- `TITLE` for the report title
- `HEADING_1` for section headings
- `NORMAL_TEXT` for paragraphs
- `createParagraphBullets` for bullet lists

This keeps the LLM output machine-parseable and the document formatting deterministic.
