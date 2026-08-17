# Google Cloud Setup

1. Create a Google Cloud project.
2. Configure the OAuth consent screen.
3. Create an OAuth client ID for a Desktop app.
4. Enable APIs:
   - Gmail API
   - Google Chat API
   - Google Meet API
   - Google Docs API
5. Download the OAuth client JSON.
6. Save it as `credentials/oauth-client.json`.

## Required Scopes

```text
openid
email
profile
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/chat.spaces.readonly
https://www.googleapis.com/auth/chat.messages.readonly
https://www.googleapis.com/auth/meetings.space.readonly
https://www.googleapis.com/auth/documents
```

Optional auth-test scope:

```text
https://www.googleapis.com/auth/chat.memberships.readonly
```
