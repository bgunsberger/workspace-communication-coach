# Provider Authentication

Workspace Communication Coach has two authentication surfaces:

- Google Workspace data access.
- LLM report generation.

Google Workspace access uses a browser OAuth flow. The user grants scoped access to Gmail, Chat, Meet, and Docs. The CLI stores the resulting Google token locally in `.tokens/`.

LLM report generation is provider-neutral in code. The default `mock` provider needs no credential and is useful for demos, sandbox tests, and renderer development.

For model-backed generation, configure a provider:

```env
LLM_PROVIDER=openai
LLM_CREDENTIAL=...
LLM_MODEL=gpt-5.6
```

```env
LLM_PROVIDER=anthropic
LLM_CREDENTIAL=...
LLM_MODEL=claude-sonnet-4-5
```

## Web App Product Flow

A production web app can give users a browser-based sign-in experience without asking them to paste model-provider keys into the client:

1. The user signs in to your app.
2. The user connects Google Workspace through OAuth.
3. Your backend stores encrypted Google refresh tokens.
4. Your backend schedules the end-of-day collection job.
5. Your backend calls the selected LLM provider using server-side credentials or an enterprise identity flow.
6. Your backend writes the formatted report to Google Docs with the user's Google token.

This keeps provider keys out of browsers and mobile apps. It also gives you a reliable place for scheduled jobs, retries, token refresh, audit logs, rate limiting, and deletion/export controls.

For a local open-source CLI, environment variables are the simplest setup. For a hosted product, use app sign-in plus server-side provider credentials.

## Short-Lived Credentials

Some providers support short-lived bearer tokens for production workloads. In that case, mint the token outside this CLI and pass it as:

```env
LLM_CREDENTIAL=...
LLM_CREDENTIAL_TYPE=bearer
```

This project does not implement provider-specific token exchange flows. Keep that logic in a backend, deployment platform, or mobile attestation layer, then pass the resulting credential to the adapter.
